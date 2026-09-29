import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { type Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly dbSecret: secretsmanager.ISecret;
  public readonly vpc: ec2.Vpc;
  public readonly dbProxySecurityGroup: ec2.SecurityGroup;
  public readonly dbProxyEndpoint: string;
  public readonly databaseName: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    this.databaseName = `app_${props.stage.replace('-', '_')}`;

    // No NAT gateways: the Fargate service and scheduled tasks run in isolated
    // subnets and reach AWS services over VPC interface endpoints (PrivateLink),
    // consistent with DirectConnect-only / no-public-egress networking.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Interface endpoints so the Fargate tasks can pull images, read secrets,
    // ship logs and talk to ECS control-plane/EventBridge without a NAT.
    const interfaceEndpoints: Record<string, ec2.InterfaceVpcEndpointAwsService> = {
      Ecr: ec2.InterfaceVpcEndpointAwsService.ECR,
      EcrDocker: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER,
      CloudWatchLogs: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      SecretsManager: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      Ecs: ec2.InterfaceVpcEndpointAwsService.ECS,
      EcsAgent: ec2.InterfaceVpcEndpointAwsService.ECS_AGENT,
      EcsTelemetry: ec2.InterfaceVpcEndpointAwsService.ECS_TELEMETRY,
      CloudWatchEvents: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_EVENTS,
    };

    for (const [name, service] of Object.entries(interfaceEndpoints)) {
      this.vpc.addInterfaceEndpoint(`${name}Endpoint`, {
        service,
        privateDnsEnabled: true,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      });
    }

    // Gateway endpoint for ECR layer storage (S3) — required alongside the ECR
    // interface endpoints for image pulls with no NAT.
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }],
    });

    this.dbSecret = new secretsmanager.Secret(this, 'DbCredentials', {
      secretName: `app-${props.stage}-db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'app' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      description: 'RDS PostgreSQL security group',
    });

    const instance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: this.databaseName,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      multiAz: true,
      allocatedStorage: 50,
      maxAllocatedStorage: 200,
      storageEncrypted: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      vpc: this.vpc,
      securityGroups: [dbSecurityGroup],
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.dbProxySecurityGroup = new ec2.SecurityGroup(this, 'DbProxySecurityGroup', {
      vpc: this.vpc,
      description: 'RDS Proxy security group',
    });

    // Proxy reaches the instance on 5432.
    dbSecurityGroup.addIngressRule(
      this.dbProxySecurityGroup,
      ec2.Port.tcp(5432),
      'RDS Proxy to PostgreSQL',
    );

    // The Fargate service and batch tasks connect to the proxy on 5432 from
    // within the VPC. Allowing the VPC CIDR (rather than importing the API
    // stack's security groups) keeps the database stack free of a reverse
    // dependency on the API stack. The proxy still enforces TLS + Secrets
    // Manager auth, so exposure is limited to authenticated in-VPC clients.
    this.dbProxySecurityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'App tier (Fargate) to RDS Proxy within the VPC',
    );

    const proxy = new rds.DatabaseProxy(this, 'DbProxy', {
      proxyTarget: rds.ProxyTarget.fromInstance(instance),
      secrets: [this.dbSecret],
      vpc: this.vpc,
      securityGroups: [this.dbProxySecurityGroup],
      dbProxyName: `app-${props.stage}-proxy`,
      requireTLS: true,
    });

    this.dbProxyEndpoint = proxy.endpoint;

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.dbSecret.secretArn,
      exportName: `app-${props.stage}-db-secret-arn`,
    });

    new cdk.CfnOutput(this, 'DbProxyEndpoint', {
      value: proxy.endpoint,
      exportName: `app-${props.stage}-db-proxy-endpoint`,
    });
  }
}
