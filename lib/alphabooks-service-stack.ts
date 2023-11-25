import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { ElasticContainerConstruct } from './constructs/elastic-container-construct';


export interface AlphabooksServiceStackProps extends cdk.StackProps {
    readonly repository: Repository;
    readonly containerPort: number;
}

export class AlphabooksServiceStack extends cdk.Stack {

    constructor(scope: Construct, id: string, props: AlphabooksServiceStackProps) {
        super(scope, id, props);

        new ElasticContainerConstruct(this, `AlphabooksServer`, props);
    }
}
