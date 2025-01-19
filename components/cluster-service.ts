import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Define the arguments for the ECS component
interface EcsArgs {
    publicSubnetIds: Input<string>[];
    privateSubnetIds: Input<string>[];
    securityGroupId: Input<string>;
    executionRoleArn: Input<string>;
    clusterArn: Input<string>
}

// Define an ECS component
export class ClusterService extends ComponentResource {
    public readonly service: aws.ecs.Service;
    public readonly taskDefinition: aws.ecs.TaskDefinition;

    constructor(name: string, args: EcsArgs, opts?: ComponentResourceOptions) {
        super("custom:resource:EcsComponent", name, {}, opts);

        // Create a task definition
        this.taskDefinition = new aws.ecs.TaskDefinition(`${name}-task`, {
            family: name,
            cpu: "256",
            memory: "512",
            networkMode: "awsvpc",
            requiresCompatibilities: ["FARGATE"],
            executionRoleArn: args.executionRoleArn,
            containerDefinitions: JSON.stringify([{
                name: "nginx",
                image: "nginx",
                essential: true,
                portMappings: [{
                    containerPort: 80,
                    hostPort: 80,
                    protocol: "tcp"
                }]
            }])
        }, { parent: this });

        // Create an ECS service
        this.service = new aws.ecs.Service(`${name}-service`, {
            cluster: args.clusterArn,
            taskDefinition: this.taskDefinition.arn,
            desiredCount: 1,
            launchType: "FARGATE",
            networkConfiguration: {
                subnets: args.publicSubnetIds,
                securityGroups: [args.securityGroupId],
                assignPublicIp: true,
            }
        }, { parent: this.taskDefinition });

        this.registerOutputs({
            service: this.service,
            taskDefinition: this.taskDefinition,
        });
    }
}