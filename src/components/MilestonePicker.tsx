import type { Milestone } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import { pluralize } from "../utils/displayUtils";
import { ItemPicker } from "./ItemPicker";

type Props = {
  milestones: Milestone[];
  selected: Milestone[];
  loadingNums: number[];
  hasMore: boolean;
  loadingMore: boolean;
  colorFor: (num: number) => string;
  onAdd: (milestone: Milestone) => void;
  onRemove: (num: number) => void;
  onLoadMore: () => void;
};

const MilestonePicker: FunctionComponent<Props> = ({
  milestones, selected, loadingNums, hasMore, loadingMore, colorFor, onAdd, onRemove, onLoadMore,
}) => (
  <ItemPicker<Milestone>
    items={milestones}
    selected={selected}
    loadingNums={loadingNums}
    hasMore={hasMore}
    loadingMore={loadingMore}
    colorFor={colorFor}
    onAdd={onAdd}
    onRemove={onRemove}
    onLoadMore={onLoadMore}
    chipLabel={(m) => m.title}
    caption={(m) => `${pluralize(m.openIssues + m.closedIssues, "issue")} · ${m.state}`}
    emptyPlaceholder="Select milestone…"
    addPlaceholder="Add milestone…"
    loadMoreLabel="Load more closed milestones"
    loadingMoreLabel="Loading closed milestones…"
  />
);

export { MilestonePicker };
