sam build
sam package --output-template packaged.yaml --s3-bucket serverless-shreya
sam deploy --template-file packaged.yaml --region us-west-2 --capabilities CAPABILITY_IAM --stack-name digital-director