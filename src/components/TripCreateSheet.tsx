"use client";

import { BottomSheet } from "./BottomSheet";
import { TripCreateForm, type CreatedTrip } from "./TripCreateForm";

type TripCreateSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (trip: CreatedTrip) => void;
};

/** The trip creation form in a bottom sheet, opened by 「새 여행 만들기」 when recent trips exist (spec 7.1). */
export function TripCreateSheet({ open, onClose, onCreated }: TripCreateSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="새 여행">
      <TripCreateForm onCreated={onCreated} />
    </BottomSheet>
  );
}
