import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface LoadBalancerArgs {
  domain: string;
  securityGroups: Input<string>[];
  subnets: Input<string>[];
  certificateArn: Input<string>;
  targetGroups: { targetGroupArn: Input<string>; hostHeader?: string }[]; // Support multiple target groups
}

export class LoadBalancer extends ComponentResource {
  public readonly loadBalancer: aws.lb.LoadBalancer;
  public readonly httpsListener: aws.lb.Listener;

  constructor(name: string, args: LoadBalancerArgs, opts?: ComponentResourceOptions) {
    super("custom:resource:LoadBalancer", name, {}, opts);

    // ✅ Create an Application Load Balancer
    this.loadBalancer = new aws.lb.LoadBalancer(`${name}-lb`, {
      name: `${name}-lb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: args.securityGroups,
      subnets: args.subnets,
      enableDeletionProtection: false,
      enableHttp2: true,
      tags: { Name: `${name}-lb` },
    }, { parent: this });

    // ✅ Create HTTPS Listener
    this.httpsListener = new aws.lb.Listener(`${name}-httpsListener`, {
      loadBalancerArn: this.loadBalancer.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-TLS-1-2-2017-01", // Improved SSL policy
      certificateArn: args.certificateArn,
      defaultActions: [
        { type: "forward", targetGroupArn: args.targetGroups[0].targetGroupArn }, // Default Target Group
      ],
    }, { parent: this.loadBalancer });

    // ✅ Redirect HTTP to HTTPS
    const httpListener = new aws.lb.Listener(`${name}-httpListener`, {
      loadBalancerArn: this.loadBalancer.arn,
      port: 80,
      protocol: "HTTP",
      defaultActions: [{
        type: "redirect",
        redirect: { protocol: "HTTPS", port: "443", statusCode: "HTTP_301" },
      }],
    }, { parent: this.loadBalancer });

    // ✅ Redirect www to non-www
    new aws.lb.ListenerRule(`${name}-www-to-non-www`, {
      listenerArn: httpListener.arn,
      priority: 100,
      conditions: [{ hostHeader: { values: [`www.${args.domain}`] } }],
      actions: [{
        type: "redirect",
        redirect: { host: args.domain, protocol: "HTTPS", port: "443", statusCode: "HTTP_301" },
      }],
    }, { parent: this.loadBalancer });

    // ✅ Add Host-based Routing for Additional Target Groups
    args.targetGroups.slice(1).forEach((tg, index) => {
      new aws.lb.ListenerRule(`${name}-route-${index + 1}`, {
        listenerArn: this.httpsListener.arn,
        priority: 200 + index, // Adjust priority
        conditions: tg.hostHeader ? [{ hostHeader: { values: [`${tg.hostHeader}.${args.domain}`] } }] : [],
        actions: [{ type: "forward", targetGroupArn: tg.targetGroupArn }],
      }, { parent: this.loadBalancer });
    });

    // ✅ Register Outputs
    this.registerOutputs({
      loadBalancerArn: this.loadBalancer.arn,
      dnsName: this.loadBalancer.dnsName,
      httpsListenerArn: this.httpsListener.arn,
    });
  }
}
