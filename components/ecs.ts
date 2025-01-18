import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Define the arguments for the ECS component
interface EcsArgs {
    publicSubnetIds: Input<string>[];
    securityGroupId: Input<string>;
    executionRoleArn: Input<string>;
}

// Define an ECS component
export class ECS extends ComponentResource {
    public readonly cluster: aws.ecs.Cluster;
    public readonly service: aws.ecs.Service;
    public readonly taskDefinition: aws.ecs.TaskDefinition;

    constructor(name: string, args: EcsArgs, opts?: ComponentResourceOptions) {
        super("custom:resource:EcsComponent", name, {}, opts);

        // Create an ECS cluster
        this.cluster = new aws.ecs.Cluster(name, {}, { parent: this });

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
            cluster: this.cluster.arn,
            taskDefinition: this.taskDefinition.arn,
            desiredCount: 1,
            launchType: "FARGATE",
            networkConfiguration: {
                subnets: args.publicSubnetIds,
                securityGroups: [args.securityGroupId],
                assignPublicIp: false,
            }
        }, { parent: this });

        this.registerOutputs({
            cluster: this.cluster,
            service: this.service,
            taskDefinition: this.taskDefinition,
        });
    }
}