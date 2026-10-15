---
title: "集成学习与SVM"
date: 2026-10-15
author: "AH"
order: 7
lang: zh
redacted: false
---

# 07 集成学习与 SVM

> 来源：黑马《机器学习宝典》  
> 重点：Bagging vs Boosting、随机森林、GBDT/XGBoost；SVM 的几何直觉。

## 7.1 集成学习思想

- 核心：**多个弱学习器组合 → 强学习器**。"三个臭皮匠顶个诸葛亮"。
- 两大流派：
  - **Bagging**（并行，降方差）：各学习器独立训练，结果投票/平均。
  - **Boosting**（串行，降偏差）：逐级修正前者的错误，加权叠加。

## 7.2 Bagging 与随机森林（Random Forest）

- **随机森林** = 多棵决策树，每棵在**样本自助采样（bootstrap）** + **特征随机子集**上训练。
- 双重随机 → 树之间低相关 → 方差显著下降，不易过拟合。
- 可输出**特征重要性**（基于不纯度下降总和）。
- 优点：稳、准、能并行、不易过拟合；缺点：树多时内存/时间开销大、黑盒一点。

## 7.3 Boosting 系列

### AdaBoost

- 给错分样本加权，下一棵重点学难的；最终按分类器准确率加权投票。

### GBDT（梯度提升决策树）

- 用**负梯度**作为残差近似，逐棵拟合；预测 = 多棵树输出之和。
- 对异常值敏感（用绝对误差/MSE 变体缓解）。

### XGBoost / LightGBM / CatBoost

- GBDT 的高效实现：二阶泰勒展开、正则化、缺失值自动处理、直方图/ leaf-wise 生长。
- 表格数据（结构化数据）的**王者**，Kaggle 常胜。
- 关键超参：`max_depth`、学习率 `eta`、子树数量、`subsample`、`colsample_bytree`。

### 7.3.1 AdaBoost 公式与推导

AdaBoost（Adaptive Boosting）串行训练 $T$ 个**弱分类器** $G_t$（通常是决策树桩），每轮**提高前一轮分错样本的权重**，最后按分类器准确率加权投票。

**① 第 $t$ 轮误差率**（权重 $w_i^{(t)}$ 已归一化，$\sum_i w_i^{(t)}=1$）：  
$\varepsilon_t = \sum_{i:\,G_t(x^{(i)})\ne y^{(i)}} w_i^{(t)}$

**② 分类器权重**（误差越小权重越大；$\varepsilon_t=0.5$ 时权重为 0，等于随机猜）：  
$\alpha_t = \frac{1}{2}\ln\frac{1-\varepsilon_t}{\varepsilon_t}$

**③ 样本权重更新**（分错的样本权重放大，分对的缩小）：  
$w_i^{(t+1)} = \frac{w_i^{(t)}\,\exp\!\left(-\alpha_t\,y^{(i)}G_t(x^{(i)})\right)}{Z_t}$  
其中 $y^{(i)},G_t(x^{(i)})\in\{-1,+1\}$，于是 $yG_t=+1$ 表示分对（指数项 $\exp(-\alpha_t)<1$ 缩小），$=-1$ 表示分错（$\exp(+\alpha_t)>1$ 放大）；$Z_t$ 为归一化常数使权重和为 1。

**④ 最终强分类器**（加权多数投票，用 sign 决定类别）：  
$G(x)=\mathrm{sign}\!\left(\sum_{t=1}^{T}\alpha_t\,G_t(x)\right)$

> 直觉：AdaBoost 把「难样本」的权重越滚越大，迫使后续弱学习器专门攻克它们；最终用准确率高者多投票。它**降低偏差**，但对噪声/异常值敏感（异常值会被反复加权）。

### 7.3.2 GBDT 公式与推导

GBDT（Gradient Boosting Decision Tree）用**加性模型** $F(x)=\sum_{t=1}^T f_t(x)$（$f_t$ 为第 $t$ 棵回归树），每步拟合「当前模型在损失上的**负梯度**」（即伪残差）。

以损失 $L(y,F)$ 为例，第 $t$ 步想最小化 $\sum_i L(y_i, F_{t-1}(x_i)+f_t(x_i))$。对 $F$ 在 $F_{t-1}$ 处一阶泰勒：  
$L(y_i, F_{t-1}+f_t) \approx L(y_i,F_{t-1}) + g_i\,f_t(x_i)$  
其中 $g_i=\left.\frac{\partial L(y_i,F)}{\partial F}\right|_{F=F_{t-1}}$。要降损失需让 $f_t$ 与 $-g_i$ 同向 → 第 $t$ 棵树的**拟合目标（伪残差）**&#x4E3A;：  
$r_{ti} = -\left.\frac{\partial L(y_i,F)}{\partial F}\right|_{F=F_{t-1}(x_i)}$

- 对 **MSE** $L=\frac12(y-F)^2$：$r_{ti}=y_i-F_{t-1}(x_i)$，即真实残差（这就是「梯度提升」名字的来历——用负梯度近似残差）。
- 对 **MAE / Huber / 二分类对数损失** 等，$r_{ti}$ 取对应负梯度，因而比 AdaBoost 更**鲁棒**（不直接靠 0/1 误分加权）。

**带收缩（shrinkage）的最终更新**：  
$F_t(x) = F_{t-1}(x) + \nu\, f_t(x),\qquad \nu\in(0,1]\ \text{为学习率}$  
小 $\nu$（如 0.1）配合多棵树，通常比大步长泛化更好。

> 与 AdaBoost 区别：AdaBoost 调整**样本权重**逐树聚焦难例；GBDT 调整**函数空间梯度**（伪残差）逐树修正预测值。二者都降偏差，但 GBDT 损失函数任意可定制、对异常值更稳。`7.4` 的 XGBoost 在其上加了**二阶导 + 正则**。

### 7.3.3 XGBoost 目标函数推导（二阶泰勒 + 正则）

第 $t$ 棵树加入后，预测 $\hat y_i^{(t)}=\hat y_i^{(t-1)}+f_t(x_i)$。目标（含正则）：  
$\mathcal{L}^{(t)}=\sum_{i=1}^m l(y_i,\hat y_i^{(t-1)}+f_t(x_i))+\Omega(f_t)+\text{const}$

对损失在 $\hat y^{(t-1)}$ 处做**二阶泰勒展开**（令 $g_i=\partial_{\hat y}l(y_i,\hat y^{(t-1)})$，$h_i=\partial_{\hat y}^2 l$）：  
$\mathcal{L}^{(t)}\approx \sum_i\left[l(y_i,\hat y^{(t-1)})+g_i f_t(x_i)+\frac{1}{2}h_i f_t^2(x_i)\right]+\Omega(f_t)$

常数项去掉，把树 $f_t$ 按叶子 $j$ 展开（设样本集 $I_j$，叶子权重 $w_j$，$f_t(x_i)=w_j$）：  
$\mathcal{L}^{(t)}=\sum_j\left[\left(\sum_{i\in I_j}g_i\right)w_j+\frac{1}{2}\left(\sum_{i\in I_j}h_i+\lambda\right)w_j^2\right]+\gamma T$

（$\Omega(f_t)=\gamma T+\frac{\lambda}{2}\sum_j w_j^2$，$T$ 为叶子数。）

对 $w_j$ 求导置零得最优叶子权重 $w_j^*=-\frac{\sum_{i\in I_j}g_i}{\sum_{i\in I_j}h_i+\lambda}$，代回得**打分函数**：  
$\mathcal{L}^{(t)*}=-\frac{1}{2}\sum_{j=1}^T\frac{(\sum_{i\in I_j}g_i)^2}{\sum_{i\in I_j}h_i+\lambda}+\gamma T$

> 这就是 XGBoost 分裂时「增益 = 分裂前得分 − 分裂后左右子树得分」的依据；用二阶导 + 正则，比 GBDT 只用一阶残差更准、更稳。

## 7.4 支持向量机（SVM）

### 核心直觉（线性可分）

- 找**间隔（margin）最大**的分割超平面；间隔边界上的样本 = **支持向量**。
- 优化（硬间隔）：  
  $\min_{\mathbf{w},b}\frac{1}{2}\|\mathbf{w}\|^2\quad \text{s.t. } y^{(i)}(\mathbf{w}^T\mathbf{x}^{(i)}+b)\ge 1$
- 引入**软间隔 + 松弛变量 + 惩罚 C**：允许少量误分，C 越大越不容忍误差（越易过拟合）。

### 核技巧（Kernel Trick）

- 低维线性不可分 → 映射到高维变线性可分，**无需显式计算高维坐标**，用核函数算内积：  
  $K(\mathbf{x},\mathbf{z})=\phi(\mathbf{x})^T\phi(\mathbf{z})$
- 常用核：线性、多项式、RBF（高斯，$\exp(-\gamma\|\mathbf{x}-\mathbf{z}\|^2)$）。
- RBF 的 $\gamma$：越大 → 决策边界越复杂 → 越易过拟合。

### SVM 优劣

- 小样本、高维（甚至特征数>样本数）表现好；核函数灵活。
- 大规模数据慢；对缩放敏感（**必须标准化**）；多分类需 OvO/OvR；超参难调。

## 7.5 集成 vs 单模型小结

| 方法       | 类型       | 降什么 | 代表                |
| -------- | -------- | --- | ----------------- |
| 随机森林     | Bagging  | 方差  | RF                |
| GBDT/XGB | Boosting | 偏差  | XGBoost, LightGBM |
| SVM      | 单模型+核    | —   | SVC               |
