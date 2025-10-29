import axios from "axios";

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

export const apiClient = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true
});

apiClient.interceptors.request.use((config) => {
	const token = window.localStorage.getItem("algobank_token");

	if (token) {
		// mutate the existing headers object instead of replacing it so TypeScript's AxiosHeaders type is preserved
		(config.headers as any).Authorization = `Bearer ${token}`;
	}

	return config;
});

interface RequestOptions<T> {
	method?: HttpMethod;
	url: string;
	data?: unknown;
	params?: Record<string, unknown>;
	transform?: (_payload: unknown) => T;
}

export const request = async <T>({
	method = "get",
	url,
	data,
	params,
	transform
}: RequestOptions<T>): Promise<T> => {
	const response = await apiClient.request({
		method,
		url,
		data,
		params
	});

	return transform ? transform(response.data) : (response.data as T);
};
