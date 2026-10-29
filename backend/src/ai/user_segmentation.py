#!/usr/bin/env python3
"""
backend/src/ai/user_segmentation.py
FoodieBite Machine Learning User Segmentation Pipeline
Uses scikit-learn K-Means and Silhouette Score analysis to cluster users based on behavioral discovery patterns.
"""

import sys
import json
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

FEATURE_NAMES = [
    'searchesCount',
    'foodDetailViews',
    'recommendationClicks',
    'favoritesAdded',
    'activeDays',
    'avgSearchesPerActiveDay',
    'recommendationCtr',
    'cuisineDiversity',
    'categoryDiversity',
    'repeatEngagementFreq',
    'scannerUsageFreq'
]

def derive_segment_label(centroid, avg_centroid):
    """
    Derive interpretable segment label and description based on feature centroids relative to population average.
    Centroid vector matches FEATURE_NAMES order.
    """
    # Centroid values
    searches = centroid[0]
    views = centroid[1]
    clicks = centroid[2]
    favorites = centroid[3]
    active_days = centroid[4]
    ctr = centroid[6]
    cuisine_div = centroid[7]
    category_div = centroid[8]
    scanner = centroid[10]

    # Rule-based behavioral matching from observed distributions
    if cuisine_div >= 2.5 and category_div >= 2.0:
        return (
            "Food Explorers",
            "Users who actively discover a wide range of cuisines and diverse food categories.",
            "#10B981"
        )
    elif views >= 4.0 or scanner >= 2.0:
        return (
            "Nutrition Information Explorers",
            "Users focused on inspecting nutritional details, ingredients, and food safety metrics.",
            "#38BDF8"
        )
    elif active_days >= 3.0 and (clicks >= 3.0 or favorites >= 2.0):
        return (
            "Highly Engaged Users",
            "Power users with frequent repeat sessions, high recommendation engagement, and active favorites.",
            "#FF6B35"
        )
    elif active_days >= 2.0 and cuisine_div <= 1.5:
        return (
            "Routine Food Seekers",
            "Users who repeatedly search and explore familiar, predictable dietary preferences.",
            "#F59E0B"
        )
    else:
        return (
            "Low-Engagement Users",
            "Users with occasional discovery activity and developing preference patterns.",
            "#94a3b8"
        )

def run_segmentation(input_data):
    users = input_data.get('users', [])
    min_users = input_data.get('minUsers', 3)

    if len(users) < min_users:
        return {
            "status": "insufficient_data",
            "message": f"Insufficient user activity data for machine learning clustering. Minimum required: {min_users} active profiles; currently available: {len(users)}.",
            "eligibleUsersCount": len(users),
            "clusters": []
        }

    # Build feature matrix
    X_raw = []
    user_ids = []
    for u in users:
        feats = u.get('features', {})
        vector = [float(feats.get(fn, 0.0)) for fn in FEATURE_NAMES]
        X_raw.append(vector)
        user_ids.append(u.get('anonymousUserId', 'anon_unknown'))

    X = np.array(X_raw, dtype=np.float64)
    n_samples = len(X)

    # Determine candidate cluster range: k between 2 and min(5, n_samples - 1)
    max_k = min(5, n_samples - 1)
    if max_k < 2:
        max_k = 2

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    best_k = 2
    best_score = -1.0
    best_kmeans = None

    # Evaluate multiple k values using Silhouette Score
    evaluation_history = []
    for k in range(2, max_k + 1):
        if k >= n_samples:
            continue
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        
        # Silhouette requires at least 2 distinct clusters and 2+ samples
        try:
            score = float(silhouette_score(X_scaled, labels))
        except Exception:
            score = 0.0

        evaluation_history.append({"k": k, "silhouetteScore": round(score, 4), "inertia": round(float(km.inertia_), 2)})

        if score > best_score:
            best_score = score
            best_k = k
            best_kmeans = km

    # If no valid clustering score, fall back to k=2
    if best_kmeans is None:
        best_kmeans = KMeans(n_clusters=2, random_state=42, n_init=10).fit(X_scaled)
        best_score = 0.0

    cluster_labels = best_kmeans.labels_
    centroids_scaled = best_kmeans.cluster_centers_
    centroids_unscaled = scaler.inverse_transform(centroids_scaled)
    pop_avg_unscaled = np.mean(X, axis=0)

    # Compile cluster descriptions
    clusters = []
    assignments = []

    for c_idx in range(best_kmeans.n_clusters):
        mask = (cluster_labels == c_idx)
        cluster_size = int(np.sum(mask))
        percentage = round((cluster_size / n_samples) * 100, 1)

        centroid = centroids_unscaled[c_idx]
        label, desc, color = derive_segment_label(centroid, pop_avg_unscaled)

        cluster_summary = {
            "clusterId": int(c_idx),
            "label": label,
            "description": desc,
            "badgeColor": color,
            "size": cluster_size,
            "percentage": percentage,
            "centroid": {
                FEATURE_NAMES[i]: round(float(centroid[i]), 2) for i in range(len(FEATURE_NAMES))
            }
        }
        clusters.append(cluster_summary)

    for i in range(n_samples):
        assignments.append({
            "anonymousUserId": user_ids[i],
            "clusterId": int(cluster_labels[i])
        })

    return {
        "status": "ready",
        "modelVersion": f"seg_kmeans_v{input_data.get('version', '1.0')}",
        "trainedAt": input_data.get('timestamp', '2026-10-24T12:00:00.000Z'),
        "algorithm": "K-Means",
        "optimalK": int(best_k),
        "silhouetteScore": round(float(best_score), 4),
        "eligibleUsersCount": n_samples,
        "featureCount": len(FEATURE_NAMES),
        "featureNames": FEATURE_NAMES,
        "evaluationHistory": evaluation_history,
        "clusters": clusters,
        "assignments": assignments
    }

if __name__ == '__main__':
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"status": "error", "message": "Empty input"}))
            sys.exit(0)
        data = json.loads(raw_input)
        result = run_segmentation(data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
