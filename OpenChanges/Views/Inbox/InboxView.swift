import SwiftUI

struct InboxView: View {
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var theme
    @State private var selectedFilter = "All"

    private let filterTabs = ["All", "Change Requests", "Feature Requests", "Maintenance"]

    private var pendingItems: [WorkItem] {
        firestoreService.workItems.filter { item in
            (item.status == .draft || item.status == .inReview) && matchesFilter(item)
        }
    }

    private func matchesFilter(_ item: WorkItem) -> Bool {
        switch selectedFilter {
        case "Change Requests": return item.type == .changeRequest
        case "Feature Requests": return item.type == .featureRequest
        case "Maintenance": return item.type == .maintenance
        default: return true
        }
    }

    private func clientName(for item: WorkItem) -> String {
        firestoreService.clients.first { $0.id == item.clientId }?.name ?? "Unknown Client"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.96, green: 0.95, blue: 0.98) // light purple/gray
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    // Header
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("Inbox")
                                .font(.largeTitle)
                                .fontWeight(.bold)

                            Text("· \(pendingItems.count) pending")
                                .font(.title3)
                                .foregroundStyle(.secondary)

                            Spacer()
                        }
                        .padding(.horizontal)

                        FilterTabs(tabs: filterTabs, selected: $selectedFilter)
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                    // Content
                    if pendingItems.isEmpty {
                        emptyState
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(pendingItems) { item in
                                    NavigationLink(value: item) {
                                        InboxItemRow(
                                            workItem: item,
                                            clientName: clientName(for: item)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.bottom, 24)
                        }
                        .refreshable {
                            firestoreService.streamWorkItems()
                        }
                    }
                }
            }
            .navigationDestination(for: WorkItem.self) { item in
                ChangeOrderReviewView(workItem: item)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "tray")
                .font(.system(size: 56))
                .foregroundStyle(.quaternary)

            Text("All caught up!")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)

            Text("No pending items in your inbox.\nNew change requests will appear here.")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)

            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    InboxView()
}
