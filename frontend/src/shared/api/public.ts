import {apiClient} from './client'

export interface PublicBestSellingDish {
    rank: number
    dishName: string
    imageUrl: string
}

export async function getPublicBestSellingDishes(
    signal?: AbortSignal,
): Promise<PublicBestSellingDish[]> {
    const response =
        await apiClient.get<PublicBestSellingDish[]>(
            '/public/menu/best-selling',
            {
                signal,
            },
        )

    return response.data
}