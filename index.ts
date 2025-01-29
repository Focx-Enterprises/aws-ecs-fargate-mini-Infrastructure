import { VPC } from "./components/vpc";
import { ClusterService } from "./components/cluster-service";
import { DnsRecords } from "./components/dns-records";

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Load the Pulumi configuration
const config = new pulumi.Config();
const domains = config.requireObject<string[]>("domains");


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
new aws.iam.RolePolicyAttachment("cloudfocx-task-execution-role-policy-attachment", {
    role: taskExecutionRole.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// Create an instance of the VPC component
const infra = new VPC("cloudfocx-vpc", {
    cidrBlock: "10.0.0.0/16",
    publicSubnetCidrs: ["10.0.1.0/24", "10.0.2.0/24"],
    privateSubnetCidrs: ["10.0.3.0/24", "10.0.4.0/24"],
});

// Create a target group
const targetGroup = new aws.lb.TargetGroup("cloudfocx-target-group", {
    port: 80,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: infra.vpc.id, // Your VPC ID
    healthCheck: {
        path: "/",
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 2,
    },
    tags: {
        Name: "cloudfocx-target-group",
    },
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
    targetGroupArn: targetGroup.arn
}, { dependsOn: [infra, cluster, targetGroup] });


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


const cert = aws.acm.getCertificate({
    domain: "*.cloud.dev.focx.org",
    statuses: ["ISSUED"],
});

const zone = aws.route53.getZone({ name: "focx.org" });

// Create the HTTPS listener using the ACM certificate ARN
new aws.lb.Listener("cloudfocx-httpsListener", {
    loadBalancerArn: loadBalancer.arn,
    port: 443,
    protocol: "HTTPS",
    sslPolicy: "ELBSecurityPolicy-2016-08", // You can adjust this SSL policy as needed
    certificateArn: cert.then(c => c.arn), // The ACM certificate ARN for the domain
    defaultActions: [
        {
            type: "forward",
            targetGroupArn: targetGroup.arn
        },
    ],
}, { dependsOn: loadBalancer });

// HTTP Listener (redirect HTTP to HTTPS)
new aws.lb.Listener("cloudfocx-httpListener", {
    loadBalancerArn: loadBalancer.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [
        {
            type: "redirect",
            redirect: {
                protocol: "HTTPS",
                port: "443",
                statusCode: "HTTP_301",
            },
        },
    ],
}, { dependsOn: loadBalancer });

new DnsRecords("cloudfocx-dns-records", {
    domains,
    zoneId: zone.then(z => z.id),
    loadBalancerDnsName: loadBalancer.dnsName,
    loadBalancerZoneId: loadBalancer.zoneId
});

// Export the ECS cluster and service name
export const ecsClusterArn = cluster.arn;
export const ecsServiceName = ecs.service.name;

// Export the VPC ID and Security Group ID and lb
export const vpcId = infra.vpc.id;
export const securityGroupId = infra.securityGroup.id;
export const loadBalancerUrl = loadBalancer.dnsName;

// Export the name servers of the hosted zone
export const zoneId = zone.then(z => z.id)
export const certARN = cert.then(c => c.arn)