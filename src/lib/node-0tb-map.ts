import type { Node0TbApiResponse, Node0TbMapResponse } from "@/types";

export function projectNode0TbMapData(data: Node0TbApiResponse): Node0TbMapResponse {
  return {
    nodes: data.nodes.map((node) => ({
      id: node.id,
      nodeCode: node.nodeCode,
      dateKdFormatted: node.dateKdFormatted,
      totalPort: node.totalPort,
      categoryKd: node.categoryKd,
      latitude: node.latitude,
      longitude: node.longitude,
      hasCoordinates: node.hasCoordinates,
    })),
    stats: data.stats,
    categories: data.categories,
  };
}
