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

  /** Fetch fixture list (optionally filter by sport) */
  async getFixtures(params?: { sportId?: string; limit?: number }) {
    const res = await this.http.get('/fixtures', { params });
    return res.data;
  }

  /** Fetch single fixture */
  async getFixture(fixtureId: string) {
    const res = await this.http.get(`/fixtures/${fixtureId}`);
    return res.data;
  }

  /** Fetch lineup for a fixture */
  async getLineup(fixtureId: string) {
    const res = await this.http.get(`/fixtures/${fixtureId}/lineups`);
    return res.data;
  }

  /** Scores snapshot for a single fixture */
  async getScoresSnapshot(fixtureId: string) {
    const res = await this.http.get(`/scores/snapshot/${fixtureId}`);
    return res.data;
  }

  /** Historical scores for a fixture (last 2 weeks) */
  async getScoresHistorical(fixtureId: string) {
    const res = await this.http.get(`/scores/historical/${fixtureId}`);
    return res.data;
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
