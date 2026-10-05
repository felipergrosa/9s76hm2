import React from "react";
import { render } from "@testing-library/react";

// lucide-react é ESM-only e o jest do CRA não transpila node_modules
jest.mock("lucide-react", () => ({ Headset: () => null }));
import { motion } from "framer-motion";
import { bentoContainer } from "../../../../components/bento/motionPresets";
import StatCard from "../../../../components/bento/StatCard";
import BentoCard from "../../../../components/bento/BentoCard";
import useCountUp from "../../../../components/bento/useCountUp";
import HeroCard from "../HeroCard";
import AgentsCard from "../AgentsCard";
import RatingsCard from "../RatingsCard";

const wrap = (ui) =>
  render(
    <motion.div variants={bentoContainer} initial="hidden" animate="show">
      {ui}
    </motion.div>
  );

test("StatCard renderiza sem crash", () => {
  const { getByText } = wrap(<StatCard label="Teste" value={42} icon={<span />} accent="#000" />);
  expect(getByText("Teste")).toBeTruthy();
});

test("HeroCard renderiza com atendentes", () => {
  const attendants = [{ id: 1, name: "Ana", online: true }];
  const { getByText } = wrap(
    <HeroCard label="Em Atendimento" value={7} icon={<span />} accent="#000" attendants={attendants} />
  );
  expect(getByText("Ana")).toBeTruthy();
});

test("AgentsCard renderiza online/total", () => {
  const { container } = wrap(<AgentsCard online={3} total={5} />);
  expect(container.textContent).toContain("/5");
});

test("RatingsCard renderiza minis", () => {
  const counters = { tickets: 10, withRating: 4, percRating: 50 };
  const { container } = wrap(<RatingsCard counters={counters} />);
  expect(container.textContent).toContain("50%");
});

test("BentoCard renderiza children", () => {
  const { getByText } = wrap(<BentoCard><p>filho</p></BentoCard>);
  expect(getByText("filho")).toBeTruthy();
});

test("useCountUp retorna número renderizável", () => {
  const Probe = () => {
    const v = useCountUp(10);
    return <span data-testid="v">{v}</span>;
  };
  const { getByTestId } = render(<Probe />);
  expect(getByTestId("v")).toBeTruthy();
});
