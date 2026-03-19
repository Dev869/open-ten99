import SwiftUI

struct ChangeOrderReviewView: View {
    @State private var workItem: WorkItem
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(SettingsService.self) private var settingsService
    @Environment(ThemeManager.self) private var theme
    @Environment(\.dismiss) private var dismiss

    @State private var showOriginalEmail = false
    @State private var isGeneratingPDF = false
    @State private var showShareSheet = false
    @State private var pdfURL: URL?
    @State private var showDiscardAlert = false

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929)
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)

    init(workItem: WorkItem) {
        _workItem = State(initialValue: workItem)
    }

    private var clientName: String {
        firestoreService.clients.first { $0.id == workItem.clientId }?.name ?? "Unknown Client"
    }

    private var hourlyRate: Double {
        settingsService.settings.hourlyRate
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(red: 0.96, green: 0.95, blue: 0.98)
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {
                    headerCard
                    originalEmailSection
                    lineItemsSection
                    totalsCard
                    Spacer(minLength: 100)
                }
                .padding()
            }

            bottomActionBar
        }
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .alert("Discard Changes?", isPresented: $showDiscardAlert) {
            Button("Discard", role: .destructive) {
                dismiss()
            }
            Button("Keep Editing", role: .cancel) {}
        } message: {
            Text("This will discard all changes to this change order.")
        }
        #if os(iOS)
        .sheet(isPresented: $showShareSheet) {
            if let pdfURL {
                ShareSheet(activityItems: [pdfURL])
            }
        }
        #endif
    }

    // MARK: - Header Card

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(clientName)
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text(workItem.subject)
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                }

                Spacer()

                Text("AI Draft")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color(red: 0.957, green: 0.447, blue: 0.714).opacity(0.3))
                    )
                    .foregroundStyle(.white)
            }

            HStack(spacing: 12) {
                Label(workItem.type.displayName, systemImage: "tag.fill")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.8))

                Label(
                    workItem.createdAt.formatted(date: .abbreviated, time: .omitted),
                    systemImage: "calendar"
                )
                .font(.caption)
                .foregroundStyle(.white.opacity(0.8))
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(
                    LinearGradient(
                        colors: [gradientStart, gradientEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
    }

    // MARK: - Original Email Section

    private var originalEmailSection: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.25)) {
                    showOriginalEmail.toggle()
                }
            } label: {
                HStack {
                    Image(systemName: "envelope.fill")
                        .foregroundStyle(theme.accentColor)

                    Text("Original Email")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.primary)

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(showOriginalEmail ? 90 : 0))
                }
                .padding(16)
            }
            .buttonStyle(.plain)

            if showOriginalEmail {
                Divider()
                    .padding(.horizontal)

                Text(workItem.sourceEmail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        )
    }

    // MARK: - Line Items Section

    private var lineItemsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Line Items")
                    .font(.headline)

                Spacer()

                Button {
                    withAnimation {
                        workItem.lineItems.append(
                            LineItem(description: "", hours: 0, cost: 0)
                        )
                    }
                } label: {
                    Label("Add Item", systemImage: "plus.circle.fill")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(theme.accentColor)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)

            ForEach(Array(workItem.lineItems.enumerated()), id: \.element.id) { index, _ in
                lineItemRow(index: index)
            }

            Spacer(minLength: 4)
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        )
    }

    private func lineItemRow(index: Int) -> some View {
        VStack(spacing: 8) {
            if index > 0 {
                Divider()
                    .padding(.horizontal, 16)
            }

            HStack(alignment: .top, spacing: 10) {
                Text("\(index + 1).")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .frame(width: 24, alignment: .trailing)
                    .padding(.top, 8)

                VStack(spacing: 8) {
                    TextField("Description", text: $workItem.lineItems[index].description, axis: .vertical)
                        .font(.subheadline)
                        .textFieldStyle(.plain)
                        .padding(10)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color(red: 0.96, green: 0.95, blue: 0.98))
                        )

                    HStack(spacing: 12) {
                        HStack(spacing: 4) {
                            Text("Hours:")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            TextField("0", value: $workItem.lineItems[index].hours, format: .number)
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .textFieldStyle(.plain)
                                .frame(width: 50)
                                .padding(6)
                                .background(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Color(red: 0.96, green: 0.95, blue: 0.98))
                                )
                                #if os(iOS)
                                .keyboardType(.decimalPad)
                                #endif
                                .onChange(of: workItem.lineItems[index].hours) {
                                    workItem.lineItems[index].cost = workItem.lineItems[index].hours * hourlyRate
                                    workItem.recalculateTotals()
                                }
                        }

                        HStack(spacing: 4) {
                            Text("Cost:")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            Text(formatCurrency(workItem.lineItems[index].cost))
                                .font(.subheadline)
                                .fontWeight(.medium)
                                .foregroundStyle(.primary)
                        }

                        Spacer()

                        Button {
                            withAnimation {
                                workItem.lineItems.remove(at: index)
                                workItem.recalculateTotals()
                            }
                        } label: {
                            Image(systemName: "trash")
                                .font(.caption)
                                .foregroundStyle(.red.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    // MARK: - Totals Card

    private var totalsCard: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Total Hours")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(String(format: "%.1f hrs", workItem.totalHours))
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            Divider()

            HStack {
                Text("Hourly Rate")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(formatCurrency(hourlyRate))
                    .font(.subheadline)
                    .fontWeight(.semibold)
            }

            Divider()

            HStack {
                Text("Total Cost")
                    .font(.headline)
                Spacer()
                Text(formatCurrency(workItem.totalCost))
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundStyle(theme.accentColor)
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
        )
    }

    // MARK: - Bottom Action Bar

    private var bottomActionBar: some View {
        HStack(spacing: 16) {
            Button {
                showDiscardAlert = true
            } label: {
                Text("Discard")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.white)
                            .shadow(color: .black.opacity(0.06), radius: 4, y: 1)
                    )
            }
            .buttonStyle(.plain)

            Button {
                Task {
                    await approveAndGenerate()
                }
            } label: {
                HStack(spacing: 6) {
                    if isGeneratingPDF {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.8)
                    }
                    Text(isGeneratingPDF ? "Generating..." : "Approve & Generate PDF")
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    if !isGeneratingPDF {
                        Image(systemName: "arrow.right")
                            .font(.caption)
                    }
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(
                            LinearGradient(
                                colors: [gradientStart, gradientEnd],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(isGeneratingPDF)
        }
        .padding(16)
        .background(
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    // MARK: - Actions

    private func approveAndGenerate() async {
        isGeneratingPDF = true
        workItem.status = .approved
        workItem.recalculateTotals()

        do {
            try await firestoreService.updateWorkItem(workItem)

            if let itemId = workItem.id {
                let url = try await firestoreService.generatePDF(workItemId: itemId)
                workItem.pdfUrl = url.absoluteString
                pdfURL = url
            }
        } catch {
            print("Error approving work item: \(error.localizedDescription)")
        }

        isGeneratingPDF = false

        if pdfURL != nil {
            showShareSheet = true
        } else {
            dismiss()
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        return formatter.string(from: NSNumber(value: value)) ?? "$\(value)"
    }
}

// MARK: - Share Sheet (iOS)

#if os(iOS)
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif

#Preview {
    @Previewable @State var workItem = WorkItem(
        type: .changeRequest,
        status: .draft,
        clientId: "1",
        sourceEmail: "Hi team, we need to update the hero section on the homepage with the new branding. Also add a CTA button that links to the new signup flow.",
        subject: "Homepage Hero Update",
        lineItems: [
            LineItem(description: "Update hero section design", hours: 3, cost: 300),
            LineItem(description: "Add CTA button with signup flow", hours: 2, cost: 200)
        ],
        totalHours: 5,
        totalCost: 500
    )
    NavigationStack {
        ChangeOrderReviewView(workItem: workItem)
    }
}
