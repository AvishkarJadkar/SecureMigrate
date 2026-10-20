import json
from dataclasses import dataclass, asdict
from typing import List, Dict, Any
import time
from app.crypto.utils import hash_data

@dataclass
class Block:
    index: int
    timestamp: float
    transactions: List[Dict[str, Any]]
    previous_hash: str
    nonce: int = 0
    hash: str = ""

    def compute_hash(self) -> str:
        """
        Computes the SHA-256 hash of the block's content.
        """
        block_dict = asdict(self)
        # We exclude the 'hash' field itself when calculating the hash
        block_dict.pop("hash", None)
        
        # Sort keys to ensure consistent hashing
        block_string = json.dumps(block_dict, sort_keys=True).encode('utf-8')
        return hash_data(block_string)

    @classmethod
    def genesis(cls) -> 'Block':
        """
        Creates the Genesis block.
        """
        genesis_block = cls(
            index=0,
            timestamp=0.0,
            transactions=[],
            previous_hash="0" * 64,
            nonce=0
        )
        genesis_block.hash = genesis_block.compute_hash()
        return genesis_block
