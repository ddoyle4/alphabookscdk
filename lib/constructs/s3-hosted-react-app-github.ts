import { Construct } from "constructs";
import { GithubSourceRepo } from "./github-source-repo";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions"
import * as codebuild from "aws-cdk-lib/aws-codebuild"
import * as iam from "aws-cdk-lib/aws-iam";
import { RemovalPolicy, SecretValue } from "aws-cdk-lib";

export class S3HostedReactAppGithub extends Construct {

    private readonly githubSourceRepo: GithubSourceRepo;
    private readonly deploymentBucket: s3.Bucket;
    private readonly id: string
    private readonly pipeline: codepipeline.Pipeline;
    private readonly builderRole: iam.Role;

    constructor(scope: Construct, id: string, props: GithubSourceRepo) {
        super(scope, id);

        this.id = id;

        this.githubSourceRepo = props;

        this.deploymentBucket = this.createDeploymentBucket();

        this.builderRole = this.createBuilderRole();

        this.pipeline = this.createPipeline();
    }

    private createDeploymentBucket(): s3.Bucket {
        const bucket = new s3.Bucket(this, `${this.id}DeploymentBucket`, {
            blockPublicAccess: {
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false,
            },
            enforceSSL: true,
            autoDeleteObjects: true,
            publicReadAccess: true,
            websiteIndexDocument: "index.html",
            websiteErrorDocument: "index.html",
            removalPolicy: RemovalPolicy.DESTROY,
        });


        return bucket;
    }

    private createBuilderRole(): iam.Role {


        const role = new iam.Role(this, `${this.id}StaticS3SiteBuilder`, {
            roleName: `${this.id}StaticS3SiteBuilder`,
            assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
        });

        this.deploymentBucket.grantPut(role);
        this.deploymentBucket.grantWrite(role);

        return role;
    }

    private createPipeline(): codepipeline.Pipeline {

        const pipelineName = `${this.id}StaticS3SiteDeploymentPipeline`;

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
                    owner: this.githubSourceRepo.githubOwnerAlias,
                    repo: this.githubSourceRepo.githubRepo,
                    branch: this.githubSourceRepo.githubBranch,
                    oauthToken: SecretValue.secretsManager(this.githubSourceRepo.githubAuthTokenSecretAlias),
                    output: sourceOutput
                })
            ]
        });

        // Build image
        const siteBuild = new codepipeline.Artifact(`${pipelineName}-BuildArtifact`);

        const buildProject = new codebuild.PipelineProject(this, "BuildNodejsApp", {
            description: "Build project for the static S3 site",
            environment: {
                buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: 18,
                        },
                    },
                    "pre_build": { 
                        commands: ['npm ci'] 
                    },
                    build: {
                        commands: [
                            'echo Build started on `date`',
                            `npm run build`,
                        ]
                    }
                },
                artifacts: {
                    "base-directory": 'build',
                    files: ['**/*'],
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
                    outputs: [siteBuild]
                })
            ]
        });

        const deployAction = new codepipeline_actions.S3DeployAction({
            actionName: 'S3Deploy',
            bucket: this.deploymentBucket,
            input: siteBuild,
        });

        pipeline.addStage({
            stageName: `${pipelineName}-DeployStage`,
            actions: [deployAction]
        })

        return pipeline;
    }



}