import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Define the arguments for the ECS component
interface EcsArgs {
  subnetIds: Input<string>[];
  securityGroupId: Input<string>;
  clusterArn: Input<string>,
  taskDefinitionArn: Input<string>,
  loadBalancer: Input<{ targetGroupArn: Input<string>, containerName: string, containerPort: number }>[]
}

// Define an ECS component
export class EcsService extends ComponentResource {
  public readonly service: aws.ecs.Service;

  constructor(name: string, args: EcsArgs, opts?: ComponentResourceOptions) {
    super("custom:resource:EcsServiceComponent", name, {}, opts);


    // Create an ECS service
    this.service = new aws.ecs.Service(`${name}`, {
      name,
      cluster: args.clusterArn,
      taskDefinition: args.taskDefinitionArn,
      desiredCount: 2,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: args.subnetIds,
        securityGroups: [args.securityGroupId],
        assignPublicIp: true,
      },
      loadBalancers: args.loadBalancer,
    }, { parent: this });

    this.registerOutputs({
      service: this.service
    });
  }
}
