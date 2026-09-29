import * as path from 'node:path';

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import { type Construct } from 'constructs';

import type * as events from 'aws-cdk-lib/aws-events';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

interface ApiStackProps extends cdk.StackProps {
  stage: string;
  eventBus: events.EventBus;
  dbSecret: secretsmanager.ISecret;
  vpc: ec2.IVpc;
  dbProxyEndpoint: string;
  databaseName: string;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const isProd = props.stage === 'prod';
    const containerPort = 3001;

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `app-${props.stage}`,
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    // Container image built from the monorepo root (see apps/api/Dockerfile).
    const image = ecs.ContainerImage.fromAsset(path.join(__dirname, '../..'), {
      file: 'apps/api/Dockerfile',
    });

    // The DB password is injected from Secrets Manager; the entrypoint composes
    // DATABASE_URL from the injected host/name/user/password.
    const dbSecrets: Record<string, ecs.Secret> = {
      DB_USERNAME: ecs.Secret.fromSecretsManager(props.dbSecret, 'username'),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
    };

    const commonEnv: Record<string, string> = {
      NODE_ENV: props.stage === 'local' ? 'development' : 'production',
      PORT: String(containerPort),
      EVENT_BUS_NAME: props.eventBus.eventBusName,
      DB_SECRET_ARN: props.dbSecret.secretArn,
      DB_HOST: props.dbProxyEndpoint,
      DB_NAME: props.databaseName,
      AWS_REGION_ENV: this.region,
    };

    // ---- Interactive API: long-lived Fargate service behind an internal ALB ----

    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/app/${props.stage}/api`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: props.vpc,
      description: 'Fargate API service security group',
      allowAllOutbound: true,
    });

    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.vpc,
      description: 'Internal ALB security group',
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(80),
      'HTTP from within the VPC (DirectConnect)',
    );

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc: props.vpc,
      internetFacing: false,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
    });

    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ApiService',
      {
        cluster,
        serviceName: `app-${props.stage}-api`,
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: isProd ? 2 : 1,
        publicLoadBalancer: false,
        loadBalancer: alb,
        listenerPort: 80,
        securityGroups: [serviceSecurityGroup],
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
        circuitBreaker: { rollback: true },
        taskImageOptions: {
          image,
          containerPort,
          environment: commonEnv,
          secrets: dbSecrets,
          logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
        },
      },
    );

    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
    });

    props.dbSecret.grantRead(fargateService.taskDefinition.taskRole);
    props.eventBus.grantPutEventsTo(fargateService.taskDefinition.taskRole);

    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: isProd ? 2 : 1,
      maxCapacity: isProd ? 6 : 2,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
    });

    // ---- Batch tier: scheduled ECS tasks (run-to-completion, no ALB) ----

    const batchLogGroup = new logs.LogGroup(this, 'BatchLogGroup', {
      logGroupName: `/app/${props.stage}/batch`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const batchSecurityGroup = new ec2.SecurityGroup(this, 'BatchSecurityGroup', {
      vpc: props.vpc,
      description: 'Fargate batch task security group',
      allowAllOutbound: true,
    });

    // One EventBridge Scheduler role shared by every batch schedule.
    const schedulerRole = new iam.Role(this, 'BatchSchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // Each job gets its own task definition so BATCH_JOB is baked into the
    // container environment — the scheduler target has no per-run override.
    const batchJobs: Array<{ id: string; job: string; expression: string }> = [
      // Murex EOD export — after end of business day, Sydney time.
      { id: 'MurexEodExport', job: 'MUREX_EOD_EXPORT', expression: 'cron(30 18 * * ? *)' },
      // CMDM daily counterparty sync — early morning, before business hours.
      { id: 'CmdmDailySync', job: 'CMDM_DAILY_SYNC', expression: 'cron(0 5 * * ? *)' },
    ];

    for (const { id, job, expression } of batchJobs) {
      const taskDef = new ecs.FargateTaskDefinition(this, `${id}TaskDef`, {
        cpu: 512,
        memoryLimitMiB: 1024,
      });
      taskDef.addContainer('batch', {
        image,
        environment: { ...commonEnv, BATCH_JOB: job },
        secrets: dbSecrets,
        logging: ecs.LogDrivers.awsLogs({ streamPrefix: id, logGroup: batchLogGroup }),
      });
      props.dbSecret.grantRead(taskDef.taskRole);
      props.eventBus.grantPutEventsTo(taskDef.taskRole);
      taskDef.grantRun(schedulerRole);

      new scheduler.Schedule(this, `${id}Schedule`, {
        scheduleName: `app-${props.stage}-${id}`,
        schedule: scheduler.ScheduleExpression.expression(
          expression,
          cdk.TimeZone.AUSTRALIA_SYDNEY,
        ),
        target: new schedulerTargets.EcsRunFargateTask(cluster, {
          taskDefinition: taskDef,
          role: schedulerRole,
          vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
          securityGroups: [batchSecurityGroup],
        }),
      });
    }

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: `http://${alb.loadBalancerDnsName}`,
      exportName: `app-${props.stage}-api-url`,
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      exportName: `app-${props.stage}-cluster-name`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: fargateService.service.serviceName,
      exportName: `app-${props.stage}-service-name`,
    });
  }
}
