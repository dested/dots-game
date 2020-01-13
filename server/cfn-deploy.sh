#!/bin/bash

set -uex

REGION="${AWS_DEFAULT_REGION:-us-west-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

aws cloudformation deploy \
	--template-file kinesis.yml \
	--stack-name dots-kinesis-stack \
	--region "${REGION}" \
	--capabilities CAPABILITY_NAMED_IAM \
	--parameter-overrides AWSAccountId="${ACCOUNT_ID}"
