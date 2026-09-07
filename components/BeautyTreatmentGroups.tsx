"use client";

import { useState } from "react";
import type { TreatmentGroup } from "@/lib/businesses";

/**
 * Beauty Connection 360-only expandable treatment/service groups. The full
 * offer is long (see the design handoff), so it's grouped by area and
 * collapsed by default rather than showing ~25 same-weight buttons at once.
 */
export function BeautyTreatmentGroups({ groups, className, itemClassName }: { groups: TreatmentGroup[]; className: string; itemClassName: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={className}>
      {groups.map((group) => {
        const open = openId === group.id;
        return (
          <div className={itemClassName} key={group.id} data-open={open}>
            <button type="button" onClick={() => setOpenId(open ? null : group.id)} aria-expanded={open}>
              <span>
                <strong>{group.title}</strong>
                <small>{group.description}</small>
              </span>
              <i aria-hidden="true">{open ? "–" : "+"}</i>
            </button>
            {open ? (
              <ul>
                {group.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
