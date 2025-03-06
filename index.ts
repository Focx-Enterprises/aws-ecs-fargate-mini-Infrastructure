import { VPC } from "./components/vpc";
import { IamRoleWithPolicy } from "./components/iam-role-with-policy";
import { EcsTask } from "./components/ecs-task";
import { EcsService } from "./components/ecs-service";
import { LoadBalancer } from "./components/load-balancer";
import { DnsRecords } from "./components/dns-records";

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Load the Pulumi configuration
const config = new pulumi.Config();
const domain = config.require("domain");


// Create an instance of the VPC component
const infra = new VPC("cloudfocx-vpc", {
  cidrBlock: "10.0.0.0/16",
  publicSubnetCidrs: ["10.0.1.0/24", "10.0.2.0/24"],
  privateSubnetCidrs: ["10.0.3.0/24", "10.0.4.0/24"],
});

// Create a target group
const wpTargetGroup = new aws.lb.TargetGroup("cloudfocx-dev-wp-target-group", {
  name: "wp-target-group",
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


const adminerTargetGroup = new aws.lb.TargetGroup("cloudfocx-dev-adminer-target-group", {
  name: "adminer-target-group",
  port: 8080,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: infra.vpc.id,
  healthCheck: {
    path: "/",
    interval: 30,
    timeout: 5,
    healthyThreshold: 2,
    unhealthyThreshold: 2,
  },
  tags: { Name: "cloudfocx-target-group" },
});

// Create an ECS cluster
const cluster = new aws.ecs.Cluster("cloudfocx-dev-cluster", { name: "cloudfocx-dev-cluster" });

const executionRole = new IamRoleWithPolicy("cloudfocx-dev-task-execution", {
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
  policyAttachmentArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

const cert = aws.acm.getCertificate({
  domain: domain,
  statuses: ["ISSUED"],
});

const lb = new LoadBalancer("cloudfocx-dev-wp", {
  domain: domain,
  securityGroups: [infra.securityGroup.id],
  subnets: infra.publicSubnets.map(v => v.id),
  certificateArn: cert.then(c => c.arn),
  targetGroups: [
    { targetGroupArn: wpTargetGroup.arn },
    { targetGroupArn: adminerTargetGroup.arn, hostHeader: "adminer" }
  ],
}, { dependsOn: [infra, wpTargetGroup, adminerTargetGroup] });


// Create task defination and service
const task = new EcsTask("cloudfocx-dev-wp-task", {
  executionRoleArn: executionRole.role.arn, // Replace with your actual IAM role ARN
  securityGroups: [infra.securityGroup.id],
  subnets: infra.publicSubnets.map(v => v.id),
}, { dependsOn: [infra, cluster] });

const ecsService = new EcsService("cloudfocx-dev-ecs-service-public", {
  clusterArn: cluster.arn,
  subnetIds: infra.publicSubnets.map(subnet => subnet.id),
  securityGroupId: infra.securityGroup.id,
  taskDefinitionArn: task.taskDefinition.arn, // Replace with your actual IAM role ARN
  loadBalancer: [
    { containerPort: 80, containerName: "wordpress", targetGroupArn: wpTargetGroup.arn },
    { containerPort: 8080, containerName: "adminer", targetGroupArn: adminerTargetGroup.arn }
  ]
}, { dependsOn: [task, wpTargetGroup, adminerTargetGroup, lb] })


const zone = aws.route53.getZone({ name: "weddingtwinkles.in" });

new DnsRecords("cloudfocx-dns-records", {
  domain: domain,
  zoneId: zone.then(z => z.id),
  albDnsName: lb.loadBalancer.dnsName,
  albZoneId: lb.loadBalancer.zoneId
});

// Export the ECS cluster and service name
export const ecsClusterArn = cluster.arn;
export const ecsServiceName = ecsService.service.name

// Export the VPC ID and Security Group ID and lb
export const vpcId = infra.vpc.id;
export const securityGroupId = infra.securityGroup.id;
export const loadBalancerUrl = lb.loadBalancer.dnsName;

// Export the name servers of the hosted zone
export const zoneId = zone.then(z => z.id)
export const certARN = cert.then(c => c.arn)

// efs id
export const mysqlEfsId = task.mysqlEfs.id
export const wpEfsId = task.wordpressEfs.id
