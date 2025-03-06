import { ComponentResource, ComponentResourceOptions, Input } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Define the arguments for the ECS component
interface EcsArgs {
  executionRoleArn: Input<string>;
}

// Define an ECS component
export class EcsTask extends ComponentResource {
  public readonly taskDefinition: aws.ecs.TaskDefinition;

  constructor(name: string, args: EcsArgs, opts?: ComponentResourceOptions) {
    super("custom:resource:EcsComponent", name, {}, opts);


    // Create a MySQL database instance (RDS can be used instead for production)
    const dbPassword = "s3cur3pa55w0rd!1357#"; // Store this securely in Secrets Manager in production
    const dbName = "weddingtwinkles_db";
    const dbUser = "weddingtwinkles_dev";

    // ✅ FIXED: Use 127.0.0.1 if running MySQL in the same task OR "mysql" if using a service discovery
    const dbHost = "127.0.0.1";

    // Create a task definition
    this.taskDefinition = new aws.ecs.TaskDefinition(`${name}-task`, {
      family: name,
      cpu: "1024",
      memory: "2048",
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: args.executionRoleArn,
      containerDefinitions: JSON.stringify([
        {
          name: "wordpress",
          image: "wordpress:latest",
          essential: true,
          dependsOn: [{ containerName: "mysql", condition: "HEALTHY" }], // ✅ FIXED: Ensure MySQL starts first
          environment: [
            { name: "WORDPRESS_DB_HOST", value: dbHost },
            { name: "WORDPRESS_DB_USER", value: dbUser },
            { name: "WORDPRESS_DB_PASSWORD", value: dbPassword },
            { name: "WORDPRESS_DB_NAME", value: dbName }
          ],
          portMappings: [{
            containerPort: 80,
            hostPort: 80,
            protocol: "tcp"
          }]
        },
        {
          name: "mysql",
          image: "mysql:5.7",
          essential: true,
          healthCheck: { // ✅ Ensure MySQL is fully started before WordPress starts
            command: ["CMD", "mysqladmin", "ping", "-h", "localhost"],
            interval: 30,
            retries: 5,
            timeout: 5,
            startPeriod: 30
          },
          environment: [
            { name: "MYSQL_ROOT_PASSWORD", value: "w3dd9ngtw9nk13s!1357#" },
            { name: "MYSQL_DATABASE", value: dbName },
            { name: "MYSQL_USER", value: dbUser },
            { name: "MYSQL_PASSWORD", value: dbPassword },
          ],
          portMappings: [{
            containerPort: 3306,
            hostPort: 3306,
            protocol: "tcp"
          }]
        },
        {
          name: "adminer", // ✅ NEW: Adminer container
          image: "adminer:latest",
          essential: false, // Not required for the main service
          dependsOn: [{ containerName: "mysql", condition: "HEALTHY" }],
          environment: [
            { name: "ADMINER_DEFAULT_SERVER", value: "127.0.0.1" } // ✅ Connects to MySQL
          ],
          portMappings: [{ containerPort: 8080, hostPort: 8080, protocol: "tcp" }]
        }
      ]),
    }, { parent: this });

    this.registerOutputs({
      taskDefinition: this.taskDefinition
    })
  }
}
