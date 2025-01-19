import { VPC } from "./components/vpc";
import { ClusterService } from "./components/cluster-service";

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

// Create an instance of the VPC component
const infra = new VPC("cloudfocx-vpc", {
    cidrBlock: "10.0.0.0/16",
    publicSubnetCidrs: ["10.0.1.0/24", "10.0.2.0/24"],
    privateSubnetCidrs: ["10.0.3.0/24", "10.0.4.0/24"],
});

// Create an ECS cluster
const cluster = new aws.ecs.Cluster("cloudfocx-dev-cluster", { name: "cloudfocx-dev-cluster" });

// Create task defination and service
const ecs = new ClusterService("cloudfocx-ecs-dev", {
    clusterArn: cluster.arn,
    publicSubnetIds: infra.publicSubnets.map(subnet => subnet.id),
    privateSubnetIds: infra.privateSubnets.map(subnet => subnet.id),
    securityGroupId: infra.securityGroup.id,
    executionRoleArn: taskExecutionRole.arn, // Replace with your actual IAM role ARN
}, { dependsOn: infra });


// Create an Application Load Balancer
const loadBalancer = new aws.lb.LoadBalancer(`cloudfocx-nginx-lb`, {
    name: `cloudfocx-nginx-lb`,
    internal: false,
    loadBalancerType: "application",
    securityGroups: [infra.securityGroup.id],
    subnets: infra.publicSubnets.map(v => v.id),
    enableDeletionProtection: false,
    enableHttp2: true,
    tags: {
        Name: `cloudfocx-nginx-lb`,
    },
}, { dependsOn: ecs });

// Create a listener for HTTP
/* const httpListener = new aws.lb.Listener(`cloudfocx-httpListener`, {
    loadBalancerArn: loadBalancer.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [
        {
            type: "redirect",
            redirect: {
                port: "443",
                protocol: "HTTPS",
                statusCode: "HTTP_301",
            },
        },
    ],
}, { dependsOn: loadBalancer }); */

// Create a listener for HTTPS
/* const httpsListener = new aws.lb.Listener("cloudfocx-httpsListener", {
    loadBalancerArn: loadBalancer.arn,
    port: 443,
    protocol: "HTTPS",
    sslPolicy: "ELBSecurityPolicy-2016-08",
    certificateArn: "arn:aws:acm:us-east-1:237994797452:certificate/5f96e81c-84ec-4511-a3fa-f18aafd1d7a6", // Replace with your certificate ARN
    defaultActions: [
        {
            type: "forward",
        },
    ],
}, { dependsOn: loadBalancer }); */

// const zoneId = "Z0132344WUPZAAVUSRT6"

// Create a DNS A and AAAA record
/* const ARecord = new aws.route53.Record("cloudfocx-influencer-api-record-a", {
    zoneId,
    name: "influencer-api.cloud.dev",
    type: "A",
    aliases: [{
        name: loadBalancer.dnsName,
        zoneId: loadBalancer.id,
        evaluateTargetHealth: false,
    }],
}); */

/* const AAAARecord = new aws.route53.Record("influencer-api-record-aaaa", {
    zoneId,
    name: "influencer-api.cloud",
    type: "AAAA",
    aliases: [{
        name: loadBalancer.dnsName,
        zoneId: loadBalancer.id,
        evaluateTargetHealth: false,
    }],
}); */


// Export the ECS cluster and service name
export const ecsClusterArn = cluster.arn;
export const ecsServiceName = ecs.service.name;

// Export the VPC ID and Security Group ID and lb
export const vpcId = infra.vpc.id;
export const securityGroupId = infra.securityGroup.id;
export const loadBalancerUrl = loadBalancer.dnsName;

// Export the name servers of the hosted zone