import { Resvg } from '@resvg/resvg-js';
import { buildGoalSvg, buildResultSvg, type GoalImageParams, type ResultImageParams } from './templates';

export function renderGoalPng(params: GoalImageParams): Buffer {
  const svg = buildGoalSvg(params);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 600 } });
  return Buffer.from(resvg.render().asPng());
}

export function renderResultPng(params: ResultImageParams): Buffer {
  const svg = buildResultSvg(params);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 600 } });
  return Buffer.from(resvg.render().asPng());
}
