import { renderItineraryPdfDocument } from '$lib/services/export/pdf-template';
import type { PlannerInput, PlannerResult } from '$lib/types/planner';

const PRINT_WINDOW_FEATURES = 'width=1000,height=800';

export function exportItineraryPdf(input: PlannerInput, result: PlannerResult): void {
	if (typeof window === 'undefined') {
		return;
	}

	const printWindow = window.open('', '_blank', PRINT_WINDOW_FEATURES);
	if (!printWindow) {
		throw new Error('Unable to open print window. Please allow pop-ups to export the itinerary.');
	}

	printWindow.document.open();
	printWindow.document.write(renderItineraryPdfDocument(input, result));
	printWindow.document.close();
	printWindow.focus();
	printWindow.print();
}
