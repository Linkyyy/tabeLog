# 上海示例底图

`shanghai.geojson` 是仅用于内置示例模式的上海外滩 / 陆家嘴地图快照，采用真实 OpenStreetMap 道路、建筑、公园及水系数据。它不替代用户记录使用的在线地图，不提供导航，也不代表全城覆盖或实时更新。

- 原始数据：[yjj0339/shanghai-osm/assets/shanghai.json](https://github.com/yjj0339/shanghai-osm/blob/b4a28e4c9876f8b4b639d8f02c96be1c3ee0e945/assets/shanghai.json)。来源提交 `b4a28e4c9876f8b4b639d8f02c96be1c3ee0e945`。
- 数据许可：© OpenStreetMap contributors，遵循 [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/)，详见 [OpenStreetMap copyright](https://www.openstreetmap.org/copyright)。本文件中的衍生数据同样以 ODbL 1.0 提供。
- 转换：根据源文件的 `lon0 / lat0 / mlx / mlz` 元数据，将米制坐标转回 WGS-84。保留 1,219 段道路、3,465 个建筑轮廓、39 处绿地和 12 处水面；按类型分组，便于高效绘制和切换主题。
- 黄浦江、苏州河由源数据的河道中心线按概览宽度绘制，岸线是制图示意，不是测绘岸线。地名标注仅用于示例概览。
- 示例店铺为虚构内容；用户自己的店铺仍由所选在线地图定位。地图中持续显示 OSM 版权及「上海示例底图」标识。
