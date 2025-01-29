import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface DnsRecordArgs {
    domains: string[];
    zoneId: pulumi.Input<string>;
    loadBalancerDnsName: pulumi.Input<string>;
    loadBalancerZoneId: pulumi.Input<string>;
}

export class DnsRecords extends pulumi.ComponentResource {
    constructor(name: string, args: DnsRecordArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:resource:DnsRecords", name, {}, opts);

        const { domains, zoneId, loadBalancerDnsName, loadBalancerZoneId } = args;

        domains.forEach(domain => {
            // Create a DNS A record (Alias) in Route 53 to point to the ALB
            new aws.route53.Record(`${name}-${domain}-record-a`, {
                zoneId: zoneId,
                name: `${domain}.cloud.dev.focx.org`, // Your domain
                type: "A",
                aliases: [{
                    name: loadBalancerDnsName,
                    zoneId: loadBalancerZoneId,  // Correct ALB hosted zone ID for Route 53
                    evaluateTargetHealth: false,
                }],
            }, { parent: this });

            // Create a DNS AAAA record (Alias) in Route 53 to point to the ALB
            new aws.route53.Record(`${name}-${domain}-record-aaaa`, {
                zoneId: zoneId,
                name: `${domain}.cloud.dev.focx.org`, // Your domain
                type: "AAAA",
                aliases: [{
                    name: loadBalancerDnsName,
                    zoneId: loadBalancerZoneId,  // Correct ALB hosted zone ID for Route 53
                    evaluateTargetHealth: false,
                }],
            }, { parent: this });
        });

        this.registerOutputs();
    }
}


