// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
 
import "hardhat/console.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

error Polygon_Lottery__NotEoughMaticEntered();
error Polygon_Lottery__NotOpen(); 
error Polygon_Lottery__TransferFailed();
error Polygon_Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 lotteryState);

/**@title Polygon Lottery Contract
 * @author atanda0x
 * @notice This contract is for creating a sample lottery contract
 * @dev This implements the Chainlink VRF Version 
 */

contract Polygon_Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {

    /** Type declaration */
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    /** State Variable */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subId;
    uint16 private constant MINIMUM_REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    /** Lottery Variables */
    address payable s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private immutable i_interval;
    uint256 private s_lastTimeStamp;

    /** Events */
    event LotteryEnter(address indexed players);
    event RequestLotteryWinner(uint256 indexed requestId);
    event LotteryWinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2, 
        uint256 entranceFee, 
        bytes32 gasLane, 
        uint64 subId, 
        uint32 callbackGasLimit) 
        VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subId = subId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;

    }

    /**
     * Enter a Lottery(With a specific amount)
     */
     
    function enterLottery() public payable {
        if(msg.value < i_entranceFee) {
            revert Polygon_Lottery__NotEoughMaticEntered();
        }
        if(s_lotteryState != LotteryState.OPEN) {
            revert Polygon_Lottery__NotOpen();
        }
        s_players.push(payable(msg.sender));
        //emit an event when we update a dynamic array or map
        emit LotteryEnter(msg.sender);
    }

    function fulfillRandomWords(
        uint256 /**requestId*/, 
        uint256[] memory randomWords
        ) 
        internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if(!success) {
            revert Polygon_Lottery__TransferFailed();
        }
        emit LotteryWinnerPicked(recentWinner);
    }

    /**
     * @dev This is the function that the Chainlink Keeper nodes call
     * they look for `upkeepNeeded` to return True.
     * the following should be true for this to return true:
     * 1. The time interval has passed between raffle runs.
     * 2. The lottery is open.
     * 3. The contract has ETH.
     * 4. Implicity, your subscription is funded with LINK.
     */
    function checkUpKeep(
        bytes calldata /**checkData*/) 
        public returns(bool upkeepNeeded, bytes memory /** performData */) {
        bool isOpen = (LotteryState.OPEN == s_lotteryState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
        return (upkeepNeeded, "0x0"); 
    }

    function performUpkeep(bytes calldata /** prformData */) external override{
        (bool upkeepNeeded, ) = checkUpKeep("");
        if(!upkeepNeeded) {
            revert Polygon_Lottery__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_lotteryState));
        }
        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId =  i_vrfCoordinator.requestRandomWords(
            i_gasLane,   
            i_subId, 
            MINIMUM_REQUEST_CONFIRMATIONS, 
            i_callbackGasLimit, 
            NUM_WORDS
        );
        emit RequestLotteryWinner(requestId);

    }

    /**
     * @dev Once `checkUpkeep` is returning `true`, this function is called
     * and it kicks off a Chainlink VRF call to get a random winner.
     */
    function getRecentWinner() public view returns(address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }


    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns(address) {
        return s_players[index];
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }
}
