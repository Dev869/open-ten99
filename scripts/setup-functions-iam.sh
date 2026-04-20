#!/usr/bin/env bash
set -e

PROJECT_ID=open-ten99
PROJECT_NUMBER=857874374600
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
GCS_SA="service-${PROJECT_NUMBER}@gs-project-accounts.iam.gserviceaccount.com"
PUBSUB_SA="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

grant() {
  local member="$1"
  local role="$2"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$member" \
    --role="$role" --condition=None --quiet >/dev/null
  echo "  ok $member → $role"
}

DEPLOYER_SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Granting deployer SA roles for scheduled functions..."
grant "$DEPLOYER_SA" roles/cloudscheduler.admin

echo "Granting event-trigger IAM bindings..."
grant "$GCS_SA"     roles/pubsub.publisher
grant "$PUBSUB_SA"  roles/iam.serviceAccountTokenCreator
grant "$COMPUTE_SA" roles/run.invoker
grant "$COMPUTE_SA" roles/eventarc.eventReceiver

echo ""
echo "Granting build-time IAM bindings (Cloud Functions v2 builds run as compute default SA)..."
grant "$COMPUTE_SA" roles/cloudbuild.builds.builder
grant "$COMPUTE_SA" roles/logging.logWriter
grant "$COMPUTE_SA" roles/artifactregistry.writer
grant "$COMPUTE_SA" roles/storage.objectViewer

echo ""
echo "Done. You can now deploy functions."
