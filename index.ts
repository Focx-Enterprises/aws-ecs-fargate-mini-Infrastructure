import { VPC } from "./components/vpc";
import { ECS } from "./components/ecs";

import * as aws from "@pulumi/aws";


// Create an IAM role for ECS task execution
const taskExecutionRole = new aws.iam.Role("cloudfocx-task-execution-role", {
    name: "cloudfocx-task-execution-role",
    assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: {
                    Service: "ecs-tasks.amazonaws.com",
                },
                Action: "sts:AssumeRole",
            },
        ],
    }),
});

// Attach the AmazonECSTaskExecutionRolePolicy to the IAM Role
new aws.iam.RolePolicyAttachment("cloud-focx-task-execution-role-policy-attachment", {
    role: taskExecutionRole.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// Create an ECS cluster
// const cluster = new aws.ecs.Cluster("cloud-focx-cluster", { name: "cloud-focx-cluster" });

// Create an instance of the VPC component
const infra = new VPC("cloudfocx-vpc", {
    cidrBlock: "10.0.0.0/16",
    publicSubnetCidrs: ["10.0.1.0/24", "10.0.2.0/24"],
    privateSubnetCidrs: ["10.0.3.0/24", "10.0.4.0/24"],
});

// Create an Elastic IP for the NAT Gateway
const natElasticIp = new aws.ec2.Eip("cloudFocx-nat-Elastic-Ip", {
    vpc: true,
});

// Create the NAT Gateway
const natGateway = new aws.ec2.NatGateway("cloudFocx-nat-Gateway", {
    allocationId: natElasticIp.id,
    subnetId: infra.publicSubnets[0].id, // Associate the NAT Gateway with the first public subnet
});

// Create an instance of the ECS component
const ecs = new ECS("cloudfocx-ecs", {
    publicSubnetIds: infra.publicSubnets.map(subnet => subnet.id),
    securityGroupId: infra.securityGroup.id,
    executionRoleArn: taskExecutionRole.arn, // Replace with your actual IAM role ARN
});

// Export the ECS cluster and service ARNs
export const ecsClusterArn = ecs.cluster.arn;
export const ecsServiceName = ecs.service.name;
export const natGatewayId = natGateway.id;

// Export the VPC ID and Security Group ID
export const vpcId = infra.vpc.id;
export const securityGroupId = infra.securityGroup.id;


// Create a Fargate task definition with an NGINX container
/* const { taskDefinition } = new awsx.ecs.FargateTaskDefinition("cloudfocx-nginx", {
    container: {
        name: "cloudfocx-nginx",
        image: "nginx",
        cpu: 256,
        memory: 512,
        essential: true,
        portMappings: [{ containerPort: 80 }],
    },
    taskRole: { roleArn: taskExecutionRole.arn },
    executionRole: { roleArn: taskExecutionRole.arn }
}); */

// Create a Fargate service to run the NGINX container
/* const service = new awsx.ecs.FargateService("nginx-service", {
    cluster: cluster.arn,
    taskDefinition: taskDefinition.arn,
    desiredCount: 1,
    networkConfiguration: {
        subnets: vpc.publicSubnetIds,
        securityGroups: [securityGroup.id],
    },
    iamRole: taskExecutionRole.arn
}); */

// Export the URL of the load balancer
// export const url = service.service.loadBalancers;
