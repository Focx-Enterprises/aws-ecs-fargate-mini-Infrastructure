import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

interface DnsRecordArgs {
  domain: string;
  zoneId: pulumi.Input<string>;
  records?: pulumi.Input<string>[]
  aliases?: pulumi.Input<{
    name: pulumi.Input<string>;
    zoneId: pulumi.Input<string>
    evaluateTargetHealth: boolean,
  }>[]
}

export class DnsRecords extends pulumi.ComponentResource {
  constructor(name: string, args: DnsRecordArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:resource:DnsRecords", name, {}, opts);

    const { domain, zoneId, records, aliases } = args;

    if (records && aliases)
      throw new Error("Custom Error: Alias records cannot be set for the root domain.");

    // Create a DNS A record (Alias) in Route 53 to point to the ALB
    new aws.route53.Record(`${name}-${domain}-record-a`, {
      zoneId: zoneId,
      name: `${domain}`, // Your domain
      type: "A",
      records,
      aliases,
    }, { parent: this });



 new aws.route53.Record(`${name}-${domain}-redirect-record-a`, {
      zoneId: zoneId,
      name: `www.${domain}`, // Your domain
      type: "A",
      records,
      aliases,
    }, { parent: this });

    // Create a DNS AAAA record (Alias) in Route 53 to point to the ALB
    new aws.route53.Record(`${name}-${domain}-record-aaaa`, {
      zoneId: zoneId,
      name: `${domain}`, // Your domain
      type: "AAAA",
      records,
      aliases,
    }, { parent: this });


   
    new aws.route53.Record(`${name}-${domain}-redirect-record-aaaa`, {
      zoneId: zoneId,
      name: `www.${domain}`, // Your domain
      type: "AAAA",
      records,
      aliases,
    }, { parent: this });

    this.registerOutputs();
  }
}
