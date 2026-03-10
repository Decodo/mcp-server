import axios from 'axios';

export type WhitelistedIp = {
  id: number;
  ip: string;
  enabled: boolean;
  created_at: string;
};

export class ProxyApiClient {
  private apiKey: string;
  private baseUrl = 'https://api.decodo.com/v2';

  constructor({ apiKey }: { apiKey: string }) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      Authorization: `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  listWhitelistedIps = async (): Promise<WhitelistedIp[]> => {
    const res = await axios.get<WhitelistedIp[]>(`${this.baseUrl}/whitelisted-ips`, {
      headers: this.headers,
    });
    return res.data;
  };

  addWhitelistedIps = async (ips: string[]): Promise<WhitelistedIp[]> => {
    const res = await axios.post<WhitelistedIp[]>(
      `${this.baseUrl}/whitelisted-ips`,
      { IPAddressList: ips },
      { headers: this.headers }
    );
    return res.data;
  };

  removeWhitelistedIp = async (id: number): Promise<void> => {
    await axios.delete(`${this.baseUrl}/whitelisted-ips/${id}`, {
      headers: this.headers,
    });
  };
}
