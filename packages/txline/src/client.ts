/**
 * TxLINE REST API client.
 * Endpoint paths verified against real devnet API (July 2026).
 */
import axios, { AxiosInstance } from 'axios';

export class TxLineClient {
  private http: AxiosInstance;

  constructor(
    private readonly apiOrigin: string,
    private jwt: string,
    private readonly apiToken: string,
  ) {
    this.http = axios.create({
      baseURL: `${apiOrigin}/api`,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': apiToken,
      },
    });
  }

  updateJwt(jwt: string) {
    this.jwt = jwt;
    this.http.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
  }

  /** All available fixtures (returns PascalCase TxLineFixture[]) */
  async getFixturesSnapshot(): Promise<any[]> {
    const res = await this.http.get('/fixtures/snapshot');
    return Array.isArray(res.data) ? res.data : [];
  }

  /** Scores snapshot for one fixture */
  async getScoresSnapshot(fixtureId: string): Promise<any> {
    const res = await this.http.get(`/scores/snapshot/${fixtureId}`);
    return Array.isArray(res.data) ? res.data[0] : res.data;
  }

  /**
   * Historical SSE-format events for a fixture.
   * Returns raw text (SSE lines: "data: {...}\n\n").
   * Use to replay/seed past events.
   */
  async getScoresUpdates(fixtureId: string): Promise<string> {
    const res = await this.http.get(`/scores/updates/${fixtureId}`, {
      responseType: 'text',
    });
    return res.data as string;
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${this.jwt}`,
      'X-Api-Token': this.apiToken,
    };
  }

  get origin() {
    return this.apiOrigin;
  }
}
