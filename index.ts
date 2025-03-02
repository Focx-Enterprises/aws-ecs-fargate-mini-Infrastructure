import { VPC } from "./components/vpc";
import { IamRoleWithPolicy } from "./components/iam-role-with-policy";
import { ClusterService } from "./components/cluster-service";
import { LoadBalancer } from "./components/load-balancer";
import { DnsRecords } from "./components/dns-records";

import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Load the Pulumi configuration
const config = new pulumi.Config();
const domains = config.requireObject<string[]>("domains");

const devProvider = new aws.Provider("cloudfocx-dev", { profile: "sysadmin" });

// Create an instance of the VPC component
const infra = new VPC("cloudfocx-vpc", {
  cidrBlock: "10.0.0.0/16",
  publicSubnetCidrs: ["10.0.1.0/24", "10.0.2.0/24"],
  privateSubnetCidrs: ["10.0.3.0/24", "10.0.4.0/24"],
}, { provider: devProvider });

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
}, { provider: devProvider });

// Create an ECS cluster
const cluster = new aws.ecs.Cluster("cloudfocx-dev-cluster", { name: "cloudfocx-dev-cluster" }, { provider: devProvider });

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
  policyAttachmentArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}, { provider: devProvider });

// Create task defination and service
const ecs = new ClusterService("cloudfocx-ecs-dev", {
  clusterArn: cluster.arn,
  publicSubnetIds: infra.publicSubnets.map(subnet => subnet.id),
  privateSubnetIds: infra.privateSubnets.map(subnet => subnet.id),
  securityGroupId: infra.securityGroup.id,
  executionRoleArn: executionRole.role.arn, // Replace with your actual IAM role ARN
  loadBalancer: [{ containerPort: 80, containerName: "nginx", targetGroupArn: targetGroup.arn }]
}, { dependsOn: [infra, cluster, targetGroup], provider: devProvider });


const cert = aws.acm.getCertificate({
  domain: "*.cloud.dev.focx.org",
  statuses: ["ISSUED"],
});

const zone = aws.route53.getZone({ name: "focx.org" });

const lb = new LoadBalancer("cloudfocx-dev-nginx", {
  securityGroups: [infra.securityGroup.id],
  subnets: infra.publicSubnets.map(v => v.id),
  certificateArn: cert.then(c => c.arn), targetGroupArn: targetGroup.arn
}, { dependsOn: [ecs, infra], provider: devProvider });

new DnsRecords("cloudfocx-dns-records", {
  domains,
  zoneId: zone.then(z => z.id),
  aliases: [{
    name: lb.loadBalancer.dnsName,
    zoneId: lb.loadBalancer.zoneId,  // Correct ALB hosted zone ID for Route 53
    evaluateTargetHealth: false,
  }]
}, { provider: devProvider });

// Export the ECS cluster and service name
export const ecsClusterArn = cluster.arn;
export const ecsServiceName = ecs.service.name;

// Export the VPC ID and Security Group ID and lb
export const vpcId = infra.vpc.id;
export const securityGroupId = infra.securityGroup.id;
// export const loadBalancerUrl = loadBalancer.dnsName;

// Export the name servers of the hosted zone
export const zoneId = zone.then(z => z.id)
export const certARN = cert.then(c => c.arn)
