import { Construct } from "constructs";
import { Duration, SecretValue, aws_ecr as ecr } from "aws-cdk-lib"
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as iam from "aws-cdk-lib/aws-iam";
import { TagStatus } from "aws-cdk-lib/aws-ecr";

export interface GithubSourcedDockerLambdaProps {
    readonly githubOwnerAlias: string;
    readonly githubRepo: string;
    readonly githubBranch: string;
    readonly githubAuthTokenSecretAlias: string;
}

export class GithubSourcedDockerEcr extends Construct {

    private repository: ecr.Repository;
    private pipeline: codepipeline.Pipeline;
    private builderRole: iam.Role;

    constructor(scope: Construct, id: string, props: GithubSourcedDockerLambdaProps) {
        super(scope, id);

        this.repository = this.createRepository(id);

        this.builderRole = this.createBuilderRole(id);

        this.pipeline = this.createDeploymentPipeline(
            id,
            props.githubOwnerAlias,
            props.githubRepo,
            props.githubBranch,
            props.githubAuthTokenSecretAlias
        );
    }

    private createBuilderRole(id: string): iam.Role {
        const ecrPolicyForCodeBuilder = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "ecr:BatchGetImage",
                "ecr:BatchCheckLayerAvailability",
                "ecr:CompleteLayerUpload",
                "ecr:DescribeImages",
                "ecr:DescribeRepositories",
                "ecr:GetDownloadUrlForLayer",
                "ecr:InitiateLayerUpload",
                "ecr:ListImages",
                "ecr:PutImage",
                "ecr:UploadLayerPart"
            ],
            resources: [
                this.repository.repositoryArn
            ]
        });

        const ecrPolicyForCodeBuilderAuthToken = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                "ecr:GetAuthorizationToken"
            ],
            resources: ['*']
        });

        return new iam.Role(this, `${id}CodeBuilderECRRole`, {
            roleName: `${id}CodeBuilderECRRole`,
            assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
            inlinePolicies: {
                ecr: new iam.PolicyDocument({
                    statements: [ecrPolicyForCodeBuilder, ecrPolicyForCodeBuilderAuthToken]
                })
            }
        });
    }

    private createDeploymentPipeline(id: string, githubAlias: string, githubRepo: string,
        githubBranch: string, githubAuthTokenSecretAlias: string): codepipeline.Pipeline {

        const pipelineName = `${id}DeploymentPipeline`;

        const pipeline = new codepipeline.Pipeline(this, pipelineName, {
            crossAccountKeys: false,
            pipelineName: pipelineName
        });

        // GitHub source stage
        const sourceOutput = new codepipeline.Artifact(`${pipelineName}-SourceArtifact`);
        pipeline.addStage({
            stageName: `${pipelineName}-SourceStage`,
            actions: [
                new codepipeline_actions.GitHubSourceAction({
                    actionName: `${pipelineName}-GithubSourceAction`,
                    owner: githubAlias,
                    repo: githubRepo,
                    branch: githubBranch,
                    oauthToken: SecretValue.secretsManager(githubAuthTokenSecretAlias),
                    output: sourceOutput
                })
            ]
        });

        // Build image
        const lambdaBuildOutput = new codepipeline.Artifact(`${pipelineName}-BuildArtifact`);

        const buildProject = new codebuild.PipelineProject(this, "BuildNodejsApp", {
            description: "Build project for the Fargate pipeline",
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
                privileged: true // true enables us to build docker images.
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            `echo Logging in to Amazon ECR, region: $AWS_DEFAULT_REGION for ${this.repository.repositoryUri} ...`,
                            `aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin ${this.repository.repositoryUri}`,
                        ]
                    },
                    build: {
                        commands: [
                            'echo Build started on `date`',
                            'echo Building the Docker image...',
                            `docker build -t ${this.repository.repositoryUri}:latest .`,
                        ]
                    },
                    post_build: {
                        commands: [
                            'echo Build completed on `date`',
                            'echo Pushing the Docker image...',
                            `docker push ${this.repository.repositoryUri}:latest`,
                        ]
                    }
                }
            }),
            role: this.builderRole
        });

        pipeline.addStage({
            stageName: `${pipelineName}-BuildStage`,
            actions: [
                new codepipeline_actions.CodeBuildAction({
                    actionName: `${pipelineName}-BuildAction`,
                    input: sourceOutput,
                    project: buildProject,
                    outputs: [lambdaBuildOutput]
                })
            ]
        });

        return pipeline;
    }

    private createRepository(id: string): ecr.Repository {
        return new ecr.Repository(this, `${id}Repository`, {
            repositoryName: `${id.toLowerCase()}-repo`,
            lifecycleRules: [
                {
                    maxImageAge: Duration.days(7),
                    description: "Remove untagged images after 3 days",
                    tagStatus: TagStatus.UNTAGGED,
                    rulePriority: 1
                } 
            ]
        });
    }
}