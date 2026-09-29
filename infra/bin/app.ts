#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { ApiStack } from '../lib/api-stack';
import { DatabaseStack } from '../lib/database-stack';
import { EventsStack } from '../lib/events-stack';

const app = new cdk.App();

const stage = (app.node.tryGetContext('stage') as string) ?? 'local';

const env: cdk.Environment = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: process.env['CDK_DEFAULT_REGION'] ?? 'ap-southeast-2',
};

const eventsStack = new EventsStack(app, `app-${stage}-events`, { env, stage });

const databaseStack = new DatabaseStack(app, `app-${stage}-database`, { env, stage });

new ApiStack(app, `app-${stage}-api`, {
  env,
  stage,
  eventBus: eventsStack.eventBus,
  dbSecret: databaseStack.dbSecret,
  vpc: databaseStack.vpc,
  dbProxyEndpoint: databaseStack.dbProxyEndpoint,
  databaseName: databaseStack.databaseName,
});
