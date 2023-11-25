import { Duration, StackProps } from "aws-cdk-lib";
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { AwsLogDriver, Cluster, CpuArchitecture, EcrImage, FargateService, FargateTaskDefinition, OperatingSystemFamily } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancer, ApplicationProtocol, ApplicationProtocolVersion } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export interface ElasticContainerConstructProps extends StackProps {
    readonly repository: Repository;
    readonly containerPort: number;
}

export class ElasticContainerConstruct extends Construct {

    private readonly ecsVpc: Vpc;
    private readonly ecsCluster: Cluster;
    private readonly id: string;
    private readonly albSecurityGroup: SecurityGroup;
    private readonly props: ElasticContainerConstructProps;
    private readonly fargateTaskDefinition: FargateTaskDefinition;
    private readonly fargateService: FargateService;

    constructor(scope: Construct, id: string, props: ElasticContainerConstructProps) {
        super(scope, id);

        this.id = id;
        this.props = props;

        this.ecsVpc = this.createVpc();

        this.ecsCluster = this.createEcsCluster();

        this.albSecurityGroup = this.createSecuirtyGroup('alb', true);

        this.albSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(props.containerPort));

        this.fargateTaskDefinition = this.createFargateTaskDefinition();
        
        this.fargateService = this.createFargateService();

        this.createApplicationLoadBalancer();
    }

    private createVpc(): Vpc {

        return new Vpc(this, `${this.id}-vpc`, {
            cidr: '10.100.0.0/16',
            maxAzs: 2
        });
    }

    private createEcsCluster(): Cluster {
        return new Cluster(this, `${this.id}-cluster`, {
            vpc: this.ecsVpc,
            clusterName: `${this.id}-cluster`,
            containerInsights: true,
        });
    }

    private createSecuirtyGroup(groupName: string, allowAllOutbound: boolean) {
        return new SecurityGroup(this, `${this.id}-${groupName}-loadbalancer-sg`, {
            vpc: this.ecsVpc,
            allowAllOutbound: allowAllOutbound,
        });
    }

    private createApplicationLoadBalancer() {
        const alb = new ApplicationLoadBalancer(this, `${this.id}-alb`, {
            vpc: this.ecsVpc,
            loadBalancerName: `${this.id}-alb`,
            internetFacing: true,
            idleTimeout: Duration.minutes(10),
            securityGroup: this.albSecurityGroup,
            http2Enabled: false,
            deletionProtection: false,
        });

        const albHttpListener = alb.addListener('HTTP listener', {
            port: this.props.containerPort,
            open: true,
            protocol: ApplicationProtocol.HTTP
        });

        const targetGroup = albHttpListener.addTargets('tcp-listener-target', {
            targetGroupName: 'tcp-target-ecs-service',
            protocol: ApplicationProtocol.HTTP,
            protocolVersion: ApplicationProtocolVersion.HTTP1,
        });

        targetGroup.addTarget(this.fargateService);

        return alb;
    }

    private createFargateTaskDefinition(): FargateTaskDefinition {
        const taskDefinition = new FargateTaskDefinition(
            this,
            'fargate-task-definition',
            {
                runtimePlatform: {
                    cpuArchitecture: CpuArchitecture.X86_64,
                    operatingSystemFamily: OperatingSystemFamily.LINUX,
                },
            }
        );

        const container = taskDefinition.addContainer(`${this.id}-container`, {
            image: EcrImage.fromEcrRepository(this.props.repository),
            logging: new AwsLogDriver({ streamPrefix: "myapp" })
        });

        container.addPortMappings({
            containerPort: this.props.containerPort
        });

        return taskDefinition;
    }

    private createFargateService(): FargateService {

        const fargateServiceSecurityGroup = this.createSecuirtyGroup('fargate', true);

        fargateServiceSecurityGroup.addIngressRule(
            Peer.securityGroupId(this.albSecurityGroup.securityGroupId),
            Port.tcp(this.props.containerPort),
            'Allow inbound connections from ALB'
        );

        return new FargateService(this, 'fargate-service', {
            cluster: this.ecsCluster,
            assignPublicIp: false,
            taskDefinition: this.fargateTaskDefinition,
            securityGroups: [fargateServiceSecurityGroup],
            desiredCount: 1,
        });
    }
}