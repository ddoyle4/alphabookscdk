import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GithubSourcedDockerEcr } from './constructs/githubsourceddockerecr';
import { Repository } from 'aws-cdk-lib/aws-ecr';

/**
 * This stack sets up all resources required to fetch, build, and 
 * store the artifacts for the code used by the AlphaBooks service.
 */
export class AlphabooksSourceBuildStack extends cdk.Stack {

    private readonly githubSourcedDockerEcr: GithubSourcedDockerEcr;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.githubSourcedDockerEcr = new GithubSourcedDockerEcr(this, 'AlphaBooksService', {
            githubRepo: 'alphabooksservice',
            githubAuthTokenSecretAlias: 'prod/github/accessToken',
            githubBranch: 'master',
            githubOwnerAlias: 'ddoyle4'
        })
    }

    public getRepository(): Repository {
        return this.githubSourcedDockerEcr.getRepository();
    }
}
