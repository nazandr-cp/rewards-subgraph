import {
  DebtSubsidiesExecuted,
  SubsidyPaymentFailed,
} from "../generated/DebtSubsidyExecutor/DebtSubsidyExecutor"; // DebtSubsidyExecutor removed
import { Epoch } from "../generated/schema"; // SubsidyTransaction, Account, Collection, Vault, UserEpochEligibility, ZERO_BI removed
// BigInt, Bytes, store, ethereum removed as they are not used in the current placeholder logic.

/**
 * @notice Handles the DebtSubsidiesExecuted event from the DebtSubsidyExecutor contract.
 * @dev This event is expected to be emitted after individual subsidy payments.
 *      This handler might be used to update aggregate data or confirm batch processing.
 *      Individual SubsidyTransaction entities should be created by the Go server logic
 *      or by a more granular event if available from the smart contract.
 *      For now, this handler will focus on updating the epoch's totalSubsidiesDistributed
 *      if the event provides enough information, or simply log the batch execution.
 *      The current event `DebtSubsidiesExecuted(epochId, signer, numSubsidies)`
 *      does not provide individual subsidy amounts. This implies that `SubsidyTransaction`
 *      entities might be created by an off-chain service that calls the executor,
 *      or if the `SubsidyPayment` struct details were part of the event.
 *
 *      Given the schema `SubsidyTransaction` has fields like `subsidyAmount`, `borrowAmountBefore/After`,
 *      these details are not directly available in `DebtSubsidiesExecuted`.
 *      This handler will primarily serve as a placeholder or for logging batch success.
 *      Actual creation of `SubsidyTransaction` entities will likely need more detailed events
 *      or off-chain data correlation.
 *
 *      Update based on plan: "These handlers will: Create or update the new entities ... based on event data."
 *      If `DebtSubsidiesExecuted` is the *only* event for successful subsidies, we lack individual amounts.
 *      Let's assume for now that the Go server, after successful execution, might provide data
 *      for individual `SubsidyTransaction` entities, or a more detailed event is planned.
 *      This handler will log the execution. If `SubsidyPayment` details were part of the event,
 *      we could create `SubsidyTransaction` here.
 *
 * @param event The DebtSubsidiesExecuted event.
 */
export function handleDebtSubsidiesExecuted(event: DebtSubsidiesExecuted): void {
  // Placeholder: Log that a batch was executed.
  // Actual SubsidyTransaction entities would need more data.
  // If the Go server creates these entities via direct GraphQL mutations after successful execution,
  // this handler might just update the Epoch's total count or status.

  const epoch = Epoch.load(event.params.epochId.toString());
  if (epoch != null) {
    // We don't have the total amount from this event, only the number of subsidies.
    // The Epoch.totalSubsidiesDistributed should be updated by handleEpochFinalized
    // or if individual subsidy events provide amounts.
    // For now, we can log or potentially update a count of successful subsidy batches if needed.
    // epoch.totalSubsidiesDistributed = epoch.totalSubsidiesDistributed.plus(SOME_AGGREGATED_AMOUNT_IF_AVAILABLE)
    // epoch.save();
  }

  // Example of what might be done if individual subsidy details were available:
  // For each payment in the batch (if event included payment details array):
  //   let subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString() + "-" + i.toString();
  //   let subsidyTx = new SubsidyTransaction(subsidyTxId);
  //   subsidyTx.epoch = event.params.epochId.toString();
  //   subsidyTx.user = payment.borrower.toHexString(); // Assuming payment struct is available
  //   subsidyTx.collection = "UNKNOWN_COLLECTION_FROM_THIS_EVENT"; // Needs more info
  //   subsidyTx.vault = "UNKNOWN_VAULT_FROM_THIS_EVENT"; // Needs more info
  //   subsidyTx.subsidyAmount = payment.amount; // Assuming payment struct is available
  //   subsidyTx.borrowAmountBefore = ZERO_BI; // Needs to be fetched or provided
  //   subsidyTx.borrowAmountAfter = ZERO_BI; // Needs to be calculated or provided
  //   subsidyTx.gasUsed = event.transaction.gasUsed;
  //   subsidyTx.blockNumber = event.block.number;
  //   subsidyTx.timestamp = event.block.timestamp;
  //   subsidyTx.transactionHash = event.transaction.hash;
  //   subsidyTx.save();

  //   // Update UserEpochEligibility
  //   let eligibilityId = payment.borrower.toHexString() + "-" + event.params.epochId.toString() + "-COLLECTION_ID";
  //   let eligibility = UserEpochEligibility.load(eligibilityId);
  //   if (eligibility != null) {
  //     eligibility.subsidyReceived = eligibility.subsidyReceived.plus(payment.amount);
  //     eligibility.save();
  //   }
}

/**
 * @notice Handles the SubsidyPaymentFailed event from the DebtSubsidyExecutor contract.
 * @dev Logs a failed subsidy payment. Could potentially create a specific entity for failed payments if needed.
 * @param event The SubsidyPaymentFailed event.
 */
export function handleSubsidyPaymentFailed(_event: SubsidyPaymentFailed): void { // event param prefixed with _
  // Placeholder: Log the failed payment.
  // A `FailedSubsidyTransaction` entity could be created if detailed tracking of failures is required.
  // For now, this serves as a hook for potential future enhancements.
  // Example:
  // let failedTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  // let failedSubsidy = new FailedSubsidy(failedTxId); // Assuming a FailedSubsidy entity
  // failedSubsidy.epoch = event.params.epochId.toString();
  // failedSubsidy.cToken = event.params.cToken.toHexString();
  // failedSubsidy.borrower = event.params.borrower.toHexString();
  // failedSubsidy.amount = event.params.amount;
  // failedSubsidy.blockNumber = event.block.number;
  // failedSubsidy.timestamp = event.block.timestamp;
  // failedSubsidy.transactionHash = event.transaction.hash;
  // failedSubsidy.save();
}

// Note on UserEpochEligibility:
// This entity (id: user.id + epoch.id + collection.id) is intended to be created/updated
// by the Go server when eligibility is determined.
// NFT balance changes (ERC721/ERC1155 transfers) might also update it.
// Borrow balance changes (CToken Borrow/Repay events) might also update it.
// The `subsidyReceived` field would be updated upon successful subsidy.
// The `isEligible` boolean would be set by the Go server.