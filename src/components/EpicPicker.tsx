import type { Epic } from "../types/GitHubTypes";
import type { FunctionComponent } from "react";
import { pluralize } from "../utils/displayUtils";
import { ItemPicker } from "./ItemPicker";

type Props = {
  epics: Epic[];
  selected: Epic[];
  loadingNums: number[];
  hasMore: boolean;
  loadingMore: boolean;
  colorFor: (num: number) => string;
  onAdd: (epic: Epic) => void;
  onRemove: (num: number) => void;
  onLoadMore: () => void;
};

const EpicPicker: FunctionComponent<Props> = ({
  epics, selected, loadingNums, hasMore, loadingMore, colorFor, onAdd, onRemove, onLoadMore,
}) => (
  <ItemPicker<Epic>
    items={epics}
    selected={selected}
    loadingNums={loadingNums}
    hasMore={hasMore}
    loadingMore={loadingMore}
    colorFor={colorFor}
    onAdd={onAdd}
    onRemove={onRemove}
    onLoadMore={onLoadMore}
    chipLabel={(e) => `◆ ${e.title}`}
    caption={(e) => `${pluralize(e.subIssueCount, "sub-issue")} · ${e.state}`}
    emptyPlaceholder="Select epic…"
    addPlaceholder="Add epic…"
    loadMoreLabel="Load more closed epics"
    loadingMoreLabel="Loading closed epics…"
  />
);

export { EpicPicker };
