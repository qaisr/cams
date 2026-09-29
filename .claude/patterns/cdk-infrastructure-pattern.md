# CDK Infrastructure Pattern

## Overview

Standard CDK patterns for PPCC enterprise applications.
All resources in ap-southeast-2, VPC private subnets,
accessible via DirectConnect only.

Canonical runtime: compute is **Fargate-only** — ONE platform, THREE task shapes:

1. **Interactive API** — long-lived NestJS (Fastify) Fargate service behind an
   internal ALB (`publicLoadBalancer: false`), target-tracking autoscale,
   `circuitBreaker: { rollback: true }`.
2. **Batch tier** — scheduled ECS Fargate tasks via EventBridge Scheduler →
   RunTask (run-to-completion). Each job (e.g. Murex EOD export, CMDM sync) has
   its own task definition, distinguished by a `BATCH_JOB` env var.
3. **Event subscribers** — long-lived NestJS Fargate workers polling SQS
   (EventBridge → SQS → Fargate poller). No API Gateway, no separate compute tier.

Supporting facts:

- **RDS PostgreSQL 16, Multi-AZ `DatabaseInstance` + RDS Proxy** (NOT Aurora).
- Auth = **in-app NestJS `JwtAuthGuard`** (passport-jwt + jwks-rsa, PingID
  RS256/JWKS) on the Fargate service. No separate authorizer stack.
- Image built from `apps/api/Dockerfile`; `DATABASE_URL` composed at container
  startup by `apps/api/docker-entrypoint.sh` from Secrets Manager creds + proxy host.
- CDK v2 (never SAM). `ecsPatterns.ApplicationLoadBalancedFargateService`,
  `ecs.Cluster`, `ecs.FargateTaskDefinition`, `aws-scheduler` +
  `aws-scheduler-targets`.
- Log groups: `/app/${stage}/api` and `/app/${stage}/batch`.

---

## 1. Stack Organisation

```typescript
// infra/bin/app.ts
const app = new cdk.App();
const env = { account: process.env.CDK_ACCOUNT, region: 'ap-southeast-2' };
const stage = app.node.tryGetContext('stage') || 'dev';

// Deploy order: Network → Database → API → Frontend → Monitoring
const network  = new NetworkStack(app, `Network-${stage}`, { env, stage });
const database = new DatabaseStack(app, `Database-${stage}`, { env, stage, vpc: network.vpc });
const api      = new ApiStack(app, `Api-${stage}`, { env, stage, vpc: network.vpc, db: database });
const frontend = new FrontendStack(app, `Frontend-${stage}`, { env, stage });
const monitor  = new MonitoringStack(app, `Monitoring-${stage}`, { env, stage, api, database });

// Tag all resources
['Project', 'Team', 'Environment', 'ManagedBy', 'CostCentre'].forEach(tag =>
  cdk.Tags.of(app).add(tag, app.node.tryGetContext(tag) || tag));
```

---

## 2. Network Stack (VPC + DirectConnect)

```typescript
// infra/lib/network-stack.ts
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'AppVpc', {
      maxAzs: 2,
      // Three subnet tiers
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          // Application tier — Fargate task ENIs + ALB ENIs
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          // RDS — no egress, no internet
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      // VPC endpoints — avoid NAT Gateway for AWS services
      gatewayEndpoints: {
        S3: { service: ec2.GatewayVpcEndpointAwsService.S3 },
      },
    });

    // Interface endpoints — AWS services via private IP (PrivateLink, no NAT)
    // DirectConnect carries traffic — no public internet
    const endpointServices = [
      ec2.InterfaceVpcEndpointAwsService.SNS,
      ec2.InterfaceVpcEndpointAwsService.SQS,
      ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      ec2.InterfaceVpcEndpointAwsService.SSM,
      ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      ec2.InterfaceVpcEndpointAwsService.XRAY,
      ec2.InterfaceVpcEndpointAwsService.ECS,
      ec2.InterfaceVpcEndpointAwsService.ECS_AGENT,
      ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
      ec2.InterfaceVpcEndpointAwsService.ECR,
      ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
    ];

    endpointServices.forEach(service =>
      this.vpc.addInterfaceEndpoint(`${service.shortName}Endpoint`, {
        service,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        privateDnsEnabled: true,
      })
    );

    // Security group for the Fargate compute tier
    this.appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc: this.vpc,
      description: 'Fargate task SG — outbound to RDS Proxy and AWS VPC endpoints',
      allowAllOutbound: true,
    });

    // Security group for RDS
    this.rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc: this.vpc,
      description: 'RDS security group — allow from the Fargate compute tier only',
      allowAllOutbound: false,
    });
    this.rdsSg.addIngressRule(
      this.appSg,
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from the Fargate compute tier'
    );
  }
}
```

---

## 3. API Stack — Fargate service behind an internal ALB

The NestJS API runs as a containerised Fargate service behind an **internal** ALB
— warm long-lived containers, no scale-out lag on the interactive paths.

```typescript
// infra/lib/api-stack.ts
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';

export class ApiStack extends cdk.Stack {
  public readonly service: ecs.FargateService;
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const isProd = props.stage === 'prod';

    // ─── ECS cluster (Fargate only — no EC2 capacity) ─────────────────────────

    this.cluster = new ecs.Cluster(this, 'AppCluster', {
      vpc: props.vpc,
      containerInsights: true,
    });

    // ─── Task role (least privilege) ──────────────────────────────────────────

    const taskRole = new iam.Role(this, 'ApiTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'NestJS API Fargate task role — least-privilege AWS access',
    });
    props.dbSecret.grantRead(taskRole);
    props.dbProxy.grantConnect(taskRole, 'appuser');
    props.eventsTopic.grantPublish(taskRole);

    // ─── Task definition + container ──────────────────────────────────────────

    const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      cpu: isProd ? 1024 : 512,
      memoryLimitMiB: isProd ? 2048 : 1024,
      taskRole,
    });

    taskDef.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromAsset('apps/api'), // Dockerfile builds the NestJS app
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: `app-${props.stage}-api`,
        logGroup: new logs.LogGroup(this, 'ApiLogGroup', {
          logGroupName: `/app/${props.stage}/api`,
          retention: isProd
            ? logs.RetentionDays.THREE_MONTHS
            : logs.RetentionDays.ONE_WEEK,
        }),
      }),
      environment: {
        NODE_ENV: props.stage,
        DB_PROXY_ENDPOINT: props.dbProxy.endpoint,
        DB_USERNAME: 'appuser',
        SNS_TOPIC_ARN: props.eventsTopic.topicArn,
        PINGID_JWKS_URI: props.pingJwksUri,
        PINGID_ISSUER: props.pingIssuer,
      },
      // Secrets injected from Secrets Manager (never env literals)
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
      },
      portMappings: [{ containerPort: 3001 }],
    });

    // ─── INTERNAL ALB + Fargate service (no public endpoints) ─────────────────

    const albService = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'ApiService',
      {
        cluster: this.cluster,
        taskDefinition: taskDef,
        desiredCount: isProd ? 2 : 1,
        // publicLoadBalancer:false → INTERNAL ALB, reachable via DirectConnect only
        publicLoadBalancer: false,
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [props.appSg],
        circuitBreaker: { rollback: true }, // auto-rollback failed deployments
      }
    );
    this.service = albService.service;

    albService.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    // ─── Target-tracking auto-scaling ─────────────────────────────────────────

    const scaling = this.service.autoScaleTaskCount({
      minCapacity: isProd ? 2 : 1,
      maxCapacity: isProd ? 10 : 2,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(120),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
    });
  }
}
```

---

## 4. Batch Tier — Scheduled ECS Fargate tasks

Async workers (Murex EOD export, CMDM sync, reporting) run as **separate**
Fargate task definitions on the request path (see NF-015 worker isolation).
Scheduled via EventBridge Scheduler → RunTask.

```typescript
// infra/lib/batch-stack.ts
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';

export class BatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BatchStackProps) {
    super(scope, id, props);

    // Shared batch task role
    const batchTaskRole = new iam.Role(this, 'BatchTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Fargate batch task role — least-privilege access',
    });
    props.dbSecret.grantRead(batchTaskRole);
    props.dbProxy.grantConnect(batchTaskRole, 'appuser');

    const batchLogGroup = new logs.LogGroup(this, 'BatchLogGroup', {
      logGroupName: `/app/${props.stage}/batch`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Helper: one task definition per job type (distinguished by BATCH_JOB env var)
    const makeBatchTask = (jobName: string, cpu = 512, mem = 1024) => {
      const taskDef = new ecs.FargateTaskDefinition(this, `${jobName}TaskDef`, {
        cpu,
        memoryLimitMiB: mem,
        taskRole: batchTaskRole,
      });
      taskDef.addContainer(`${jobName}Container`, {
        image: ecs.ContainerImage.fromAsset('apps/api'),
        environment: {
          NODE_ENV: props.stage,
          BATCH_JOB: jobName,
          DB_PROXY_ENDPOINT: props.dbProxy.endpoint,
          DB_USERNAME: 'appuser',
        },
        secrets: {
          DB_PASSWORD: ecs.Secret.fromSecretsManager(props.dbSecret, 'password'),
        },
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: `${jobName}`,
          logGroup: batchLogGroup,
        }),
      });
      return taskDef;
    };

    // Murex EOD export — nightly 22:00 AEST (12:00 UTC)
    const murexTaskDef = makeBatchTask('murex-eod-export', 1024, 2048);
    new scheduler.Schedule(this, 'MurexEodSchedule', {
      schedule: scheduler.ScheduleExpression.cron({ hour: '12', minute: '0' }),
      target: new schedulerTargets.EcsRunTask({
        cluster: props.cluster,
        taskDefinition: murexTaskDef,
        launchType: ecs.LaunchType.FARGATE,
        subnetIds: props.vpc.privateSubnets.map(s => s.subnetId),
        securityGroups: [props.appSg],
      }),
    });

    // CMDM counterparty sync — daily 06:00 AEST (20:00 UTC previous day)
    const cmdmTaskDef = makeBatchTask('cmdm-counterparty-sync');
    new scheduler.Schedule(this, 'CmdmSyncSchedule', {
      schedule: scheduler.ScheduleExpression.cron({ hour: '20', minute: '0' }),
      target: new schedulerTargets.EcsRunTask({
        cluster: props.cluster,
        taskDefinition: cmdmTaskDef,
        launchType: ecs.LaunchType.FARGATE,
        subnetIds: props.vpc.privateSubnets.map(s => s.subnetId),
        securityGroups: [props.appSg],
      }),
    });
  }
}
```

---

## 5. CDK Context and Config

```json
// infra/cdk.json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts",
  "watch": { "include": ["**"], "exclude": ["README.md", "cdk*.json", "node_modules"] },
  "context": {
    "Project":     "{app-name}",
    "Team":        "{team-name}",
    "ManagedBy":   "CDK",

    "dev": {
      "CostCentre": "{cost-centre}",
      "pingJwksUri": "https://ping-dev.internal.ppcc.com.au/.well-known/jwks.json"
    },
    "staging": {
      "CostCentre": "{cost-centre}",
      "pingJwksUri": "https://ping-staging.internal.ppcc.com.au/.well-known/jwks.json"
    },
    "prod": {
      "CostCentre": "{cost-centre}",
      "pingJwksUri": "https://ping.internal.ppcc.com.au/.well-known/jwks.json"
    }
  }
}
```

---

## 6. CDK Quality Rules

```typescript
// cdk-nag for compliance checking
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

// Add to app.ts
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Suppress rules with documented reason
NagSuppressions.addResourceSuppressions(taskRole, [
  {
    id: 'AwsSolutions-IAM5',
    reason: 'Fargate task role uses wildcard only for CloudWatch Logs stream creation',
  },
]);
```

## Rules (Never Break These)

- All resources: ap-southeast-2 only
- Compute: **Fargate only** — interactive API behind an internal ALB, batch as scheduled tasks, event workers as SQS-polling Fargate services
- All Fargate tasks in VPC private subnets (no public IP)
- All RDS: isolated subnets, no public access; **RDS Proxy** always retained
- All deployments: via GitHub Actions running AWS CDK v2 (no manual `cdk deploy` to prod)
- All secrets: Secrets Manager (no env var literals)
- All stacks: tagged with Project, Environment, CostCentre
- Production: termination protection enabled
- Ingress: **internal only** — internal ALB; **no public endpoints** on any tier
- Log groups: `/app/${stage}/api` (API service) and `/app/${stage}/batch` (batch tasks)

## Cross-References

- DevOps agent: `@.claude/agents/devops-engineer.md`
- Deployment: `@.claude/workflows/deployment.md`
- Security: `@.claude/standards/security-standards.md`
- Monitoring: `@.claude/standards/observability-standards.md`
- RDS Proxy: `@.claude/patterns/rds-proxy-pattern.md`

## Token Optimization

**Load when** authoring or modifying AWS CDK stacks. **Load only**: this pattern + the standard that owns its domain. **Unload after** the change is committed and verified — patterns are reference material, not session-resident.
