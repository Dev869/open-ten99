#!/usr/bin/env bash
set -e

PROJECT_ID=open-ten99
PROJECT_NUMBER=857874374600
SA_EMAIL="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
REPO="Dev869/open-ten99"

echo "Granting roles to $SA_EMAIL..."
for role in \
  roles/firebase.admin \
  roles/firebasehosting.admin \
  roles/cloudfunctions.admin \
  roles/iam.serviceAccountUser \
  roles/artifactregistry.admin \
  roles/datastore.owner \
  roles/storage.admin \
  roles/run.admin
do
  echo "  - $role"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
done

echo "Binding WIF principal for $REPO..."
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}" \
  --quiet >/dev/null

echo ""
echo "Done. Add these to GitHub repo secrets:"
echo "  WIF_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "  WIF_SERVICE_ACCOUNT=$SA_EMAIL"
