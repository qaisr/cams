import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import { type Construct } from 'constructs';

interface EventsStackProps extends cdk.StackProps {
  stage: string;
}

export class EventsStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `app-${props.stage}-bus`,
    });

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      exportName: `app-${props.stage}-event-bus-arn`,
    });

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      exportName: `app-${props.stage}-event-bus-name`,
    });
  }
}
