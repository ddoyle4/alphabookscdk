import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AlphaBooksService } from './alphabooksservice';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class AlphabookscdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new AlphaBooksService(this, "AlphaBooksService")
  }
}
