import type { NodeCoordinateItem, NodeCoordinatesResponse } from "@/types";

export function projectNodeCoordinates(payload: { data: NodeCoordinateItem[] }): NodeCoordinatesResponse {
    return {
        data: payload.data.map((node) => ({
            id: node.id,
            name: node.name,
            latitude: node.latitude,
            longitude: node.longitude,
        })),
    };
}
