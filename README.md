# Yixuanqi · Creative Universe

独立的个人项目门户。它只负责展示与发现作品，不保存第二份项目清单，也不承载各项目的源码。

## 数据架构

- 门户仓库：`yixuanqi/yixuanqi.github.io`
- 唯一项目目录：[`PhotoGallery/docs/projects.json`](https://github.com/yixuanqi/PhotoGallery/blob/main/docs/projects.json)
- 在线目录数据：`https://yixuanqi.github.io/PhotoGallery/projects.json`
- 星海入口：`https://yixuanqi.github.io/PhotoGallery/galaxy/`

项目名称、分类、标签、状态、主入口和源码仓库均从项目目录动态读取。门户代码不维护项目数组。

## 本地预览

在仓库根目录执行：

```bash
python -m http.server 8080
```

浏览器访问 `http://localhost:8080`。请使用本地 HTTP 服务，不要直接双击 `index.html`，因为浏览器会限制本地文件读取。

## 新增或更新项目

1. 在 `PhotoGallery` 对应项目目录中完成项目与发布。
2. 更新 `PhotoGallery/docs/projects.json`，确保 ID、入口 URL、分类和状态准确。
3. 提交并部署 `PhotoGallery`。
4. 门户会在下次访问时读取最新目录并自动显示，无需修改本仓库的项目卡片。

项目目录规范见 [PhotoGallery Web 项目管理规范](https://github.com/yixuanqi/PhotoGallery/blob/main/docs/web-projects/PROJECT_MANAGEMENT_STANDARD.md)。

## 部署

GitHub Actions 通过 GitHub Pages Artifact 部署本仓库。工作流会先检查 HTML/JS 本地资源引用，并从公开项目目录读取数据，检查字段、唯一 ID 与 HTTPS 链接。

固定门户地址：`https://yixuanqi.github.io/`
