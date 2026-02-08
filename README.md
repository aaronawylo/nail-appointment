Website located at: https://main.d39cw2djhxzpjt.amplifyapp.com

Nail Service Booking API (AWS Serverless)
This backend consists of AWS Lambda functions integrated with API Gateway, utilizing DynamoDB for data storage and S3 for image management, as a demonstration of an appointment system for a generalist website.

Tech Stack
Runtime: Node.js 18.x+

Database: Amazon DynamoDB

Storage: Amazon S3

Auth: Amazon Cognito (Authorizer)

SDK: AWS SDK v3 (@aws-sdk/client-dynamodb, @aws-sdk/client-s3)

Prerequisites
AWS CLI configured.

DynamoDB Table created with a GSI named TimeIndex (Partition Key: appointmentTime).

S3 Bucket configured for public read or via CloudFront.

Environment Variables
Ensure the following are set in the Lambda Configuration:

REGION: e.g., us-west-2

TABLE_NAME: Your DynamoDB table name.

BUCKET_NAME: Your S3 gallery bucket name.

CORS Configuration
The functions use dynamic origin matching. To add a new domain, update the ALLOWED_ORIGINS array in the Lambda source code:

JavaScript
const ALLOWED_ORIGINS = ["http://localhost:3000", "https://your-amplify-url.com"];
