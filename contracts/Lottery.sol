// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;
 
import "hardhat/console.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";

error Polygon_Lottery__NotEoughMaticEntered();

contract Polygon_Lottery is VRFConsumerBaseV2{
    /** State Variable */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    /** Events */
    event LotteryEnter(address indexed players);

    constructor(address vrfCoordinatorV2,uint256 entranceFee) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
    }
    /**
     * Enter a Lottery(With a specific amount)
     */
     
    function enterLottery() public payable {
        if(msg.value < i_entranceFee) {
            revert Polygon_Lottery__NotEoughMaticEntered();
        }
        s_players.push(payable(msg.sender));
        //emit an event when we update a dynamic array or map
        emit LotteryEnter(msg.sender);
    }

    function requestRandomWinner() external {

    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {

    }

    /**
     * Pick a random winner(verifiably random)
     */
     //function pickRandomWinner(){}

    function getEntranceFee() public view returns(uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns(address) {
        return s_players[index];
    }
}
