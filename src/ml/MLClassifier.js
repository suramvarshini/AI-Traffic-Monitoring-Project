/**
 * Random Forest & Decision Tree Classifier in JavaScript
 * Pure ES6 implementation for student projects and embedded AI evaluation.
 */

class TreeNode {
  constructor({ feature, threshold, isCategorical, categories, left, right, value, impurity, samples }) {
    this.feature = feature;           // Feature name to split on
    this.threshold = threshold;       // Numeric threshold if numeric
    this.isCategorical = isCategorical; // Boolean
    this.categories = categories;     // Left-branch categories if categorical
    this.left = left;                 // Left child node
    this.right = right;               // Right child node
    this.value = value;               // Class probabilities/counts if leaf node
    this.impurity = impurity;         // Gini impurity
    this.samples = samples;           // Sample count
  }

  isLeaf() {
    return this.value !== undefined;
  }
}

class DecisionTreeClassifier {
  constructor({ maxDepth = 6, minSamplesSplit = 4, maxFeatures = null }) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.maxFeatures = maxFeatures;
    this.root = null;
    this.featureImportances = {};
  }

  _giniImpurity(labels) {
    if (labels.length === 0) return 0;
    const counts = {};
    for (const label of labels) {
      counts[label] = (counts[label] || 0) + 1;
    }
    let impurity = 1.0;
    for (const label in counts) {
      const p = counts[label] / labels.length;
      impurity -= p * p;
    }
    return impurity;
  }

  _evaluateSplit(data, feature, isCategorical, thresholdOrCat) {
    let leftData = [], rightData = [];
    if (isCategorical) {
      for (const item of data) {
        if (item[feature] === thresholdOrCat) leftData.push(item);
        else rightData.push(item);
      }
    } else {
      for (const item of data) {
        if (item[feature] <= thresholdOrCat) leftData.push(item);
        else rightData.push(item);
      }
    }

    if (leftData.length === 0 || rightData.length === 0) return null;

    const leftLabels = leftData.map(d => d.target);
    const rightLabels = rightData.map(d => d.target);

    const leftGini = this._giniImpurity(leftLabels);
    const rightGini = this._giniImpurity(rightLabels);

    const weightLeft = leftData.length / data.length;
    const weightRight = rightData.length / data.length;
    const splitImpurity = weightLeft * leftGini + weightRight * rightGini;

    return { leftData, rightData, splitImpurity, leftGini, rightGini };
  }

  _buildTree(data, features, depth = 0) {
    const labels = data.map(d => d.target);
    const currentImpurity = this._giniImpurity(labels);

    // Leaf conditions
    const uniqueLabels = [...new Set(labels)];
    if (uniqueLabels.length === 1 || depth >= this.maxDepth || data.length < this.minSamplesSplit) {
      const counts = {};
      for (const l of labels) counts[l] = (counts[l] || 0) + 1;
      return new TreeNode({ value: counts, impurity: currentImpurity, samples: data.length });
    }

    // Select candidate features
    let candidateFeatures = [...features];
    if (this.maxFeatures && this.maxFeatures < features.length) {
      candidateFeatures = candidateFeatures.sort(() => 0.5 - Math.random()).slice(0, this.maxFeatures);
    }

    let bestGain = 0;
    let bestSplit = null;

    for (const feature of candidateFeatures) {
      const sampleVal = data[0][feature];
      const isCategorical = typeof sampleVal === 'string';

      if (isCategorical) {
        const uniqueVals = [...new Set(data.map(d => d[feature]))];
        for (const val of uniqueVals) {
          const res = this._evaluateSplit(data, feature, true, val);
          if (res) {
            const gain = currentImpurity - res.splitImpurity;
            if (gain > bestGain) {
              bestGain = gain;
              bestSplit = { feature, isCategorical: true, categories: [val], ...res };
            }
          }
        }
      } else {
        const vals = data.map(d => d[feature]).sort((a, b) => a - b);
        // Test step percentiles for speed
        const step = Math.max(1, Math.floor(vals.length / 10));
        for (let i = step; i < vals.length; i += step) {
          const thresh = (vals[i - 1] + vals[i]) / 2;
          const res = this._evaluateSplit(data, feature, false, thresh);
          if (res) {
            const gain = currentImpurity - res.splitImpurity;
            if (gain > bestGain) {
              bestGain = gain;
              bestSplit = { feature, isCategorical: false, threshold: thresh, ...res };
            }
          }
        }
      }
    }

    if (!bestSplit || bestGain <= 0) {
      const counts = {};
      for (const l of labels) counts[l] = (counts[l] || 0) + 1;
      return new TreeNode({ value: counts, impurity: currentImpurity, samples: data.length });
    }

    // Accumulate feature importance
    this.featureImportances[bestSplit.feature] = (this.featureImportances[bestSplit.feature] || 0) + (bestGain * data.length);

    const left = this._buildTree(bestSplit.leftData, features, depth + 1);
    const right = this._buildTree(bestSplit.rightData, features, depth + 1);

    return new TreeNode({
      feature: bestSplit.feature,
      threshold: bestSplit.threshold,
      isCategorical: bestSplit.isCategorical,
      categories: bestSplit.categories,
      left,
      right,
      impurity: currentImpurity,
      samples: data.length
    });
  }

  fit(data, features, targetKey = 'target') {
    const formattedData = data.map(d => ({ ...d, target: d[targetKey] }));
    this.featureImportances = {};
    this.root = this._buildTree(formattedData, features);
  }

  _predictSample(node, sample) {
    if (node.isLeaf()) return node.value;

    if (node.isCategorical) {
      if (node.categories.includes(sample[node.feature])) {
        return this._predictSample(node.left, sample);
      } else {
        return this._predictSample(node.right, sample);
      }
    } else {
      if (sample[node.feature] <= node.threshold) {
        return this._predictSample(node.left, sample);
      } else {
        return this._predictSample(node.right, sample);
      }
    }
  }

  predictProba(sample) {
    const counts = this._predictSample(this.root, sample);
    let total = 0;
    for (const k in counts) total += counts[k];
    const proba = {};
    for (const k in counts) proba[k] = counts[k] / total;
    return proba;
  }
}

class RandomForestClassifier {
  constructor({ numTrees = 10, maxDepth = 6, minSamplesSplit = 4 }) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.trees = [];
    this.features = [];
    this.classes = [];
    this.featureImportances = {};
  }

  fit(data, features, targetKey = 'accidentRisk') {
    this.features = features;
    this.classes = [...new Set(data.map(d => d[targetKey]))];
    this.trees = [];
    this.featureImportances = {};

    const maxFeatures = Math.max(1, Math.floor(Math.sqrt(features.length)));

    for (let i = 0; i < this.numTrees; i++) {
      // Bootstrap sampling (random sampling with replacement)
      const bootstrapSample = [];
      for (let j = 0; j < data.length; j++) {
        const idx = Math.floor(Math.random() * data.length);
        bootstrapSample.push(data[idx]);
      }

      const tree = new DecisionTreeClassifier({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        maxFeatures
      });

      tree.fit(bootstrapSample, features, targetKey);
      this.trees.push(tree);

      // Accumulate importances
      for (const feat in tree.featureImportances) {
        this.featureImportances[feat] = (this.featureImportances[feat] || 0) + tree.featureImportances[feat];
      }
    }

    // Normalize feature importances
    let totalImp = 0;
    for (const feat in this.featureImportances) totalImp += this.featureImportances[feat];
    if (totalImp > 0) {
      for (const feat in this.featureImportances) {
        this.featureImportances[feat] = parseFloat((this.featureImportances[feat] / totalImp).toFixed(4));
      }
    }
  }

  predictProba(sample) {
    const aggProba = {};
    for (const cls of this.classes) aggProba[cls] = 0;

    for (const tree of this.trees) {
      const treeProba = tree.predictProba(sample);
      for (const cls in treeProba) {
        aggProba[cls] = (aggProba[cls] || 0) + treeProba[cls];
      }
    }

    for (const cls in aggProba) {
      aggProba[cls] = parseFloat((aggProba[cls] / this.numTrees).toFixed(4));
    }

    return aggProba;
  }

  predict(sample) {
    const proba = this.predictProba(sample);
    let bestClass = null;
    let maxP = -1;

    for (const cls in proba) {
      if (proba[cls] > maxP) {
        maxP = proba[cls];
        bestClass = cls;
      }
    }

    return {
      prediction: bestClass,
      probabilities: proba,
      confidence: Math.round(maxP * 100)
    };
  }
}

module.exports = {
  DecisionTreeClassifier,
  RandomForestClassifier
};
